// The single source of truth for what a user can do, derived from their
// subscription. Every Pro-gated route and UI surface should consult this rather
// than checking subscription fields directly.
import { prisma } from "@/lib/db";

export type Plan = "free" | "pro";

export interface Entitlements {
  plan: Plan;
  isPro: boolean;
  /** Plans a free user may generate per rolling 7 days; null = unlimited. */
  weeklyPlanLimit: number | null;
  /** Address → cheapest real store nearby. */
  cheapestStore: boolean;
  /** Automatic weekly plan email. */
  weeklyEmail: boolean;
  /** Persisted plan history. */
  planHistory: boolean;
  /** More than one saved address. */
  multipleAddresses: boolean;
  /** Swap a single meal and recalc (vs. regenerate the whole week). */
  swapMeal: boolean;
}

export const FREE_WEEKLY_PLAN_LIMIT = 1;

const FREE: Entitlements = {
  plan: "free",
  isPro: false,
  weeklyPlanLimit: FREE_WEEKLY_PLAN_LIMIT,
  cheapestStore: false,
  weeklyEmail: false,
  planHistory: false,
  multipleAddresses: false,
  swapMeal: false,
};

const PRO: Entitlements = {
  plan: "pro",
  isPro: true,
  weeklyPlanLimit: null,
  cheapestStore: true,
  weeklyEmail: true,
  planHistory: true,
  multipleAddresses: true,
  swapMeal: true,
};

// Stripe statuses that should keep Pro features unlocked.
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Pure mapping from subscription fields → entitlements. Easy to unit-test. */
export function entitlementsFor(
  plan: string | null | undefined,
  status: string | null | undefined,
): Entitlements {
  return plan === "pro" && ACTIVE_STATUSES.has(status ?? "") ? PRO : FREE;
}

/** Entitlements for a signed-in user (no subscription row ⇒ free). */
export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true },
  });
  return entitlementsFor(sub?.plan, sub?.status);
}

/** Entitlements for a logged-out visitor. */
export const ANONYMOUS_ENTITLEMENTS = FREE;
