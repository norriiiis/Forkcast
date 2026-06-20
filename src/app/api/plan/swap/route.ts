import { NextResponse } from "next/server";
import { loadPool, swapMeal, type Diet, type Preferences } from "@/lib/engine";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { allow, clientIp } from "@/lib/ratelimit";

// Prisma needs the Node runtime; always run fresh.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIETS: Diet[] = ["none", "vegetarian", "vegan", "pescatarian"];

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Sanitize the engine-native Preferences the client echoes back from the plan
// it's editing (not the live form), so a swap respects the plan's own filters.
function sanitizePrefs(p: unknown): Preferences {
  const o = (p ?? {}) as Record<string, unknown>;
  const budgetCents = Number(o.budgetCents);
  return {
    servings: clamp(Number(o.servings), 1, 8),
    nights: clamp(Number(o.nights), 3, 6),
    diet: DIETS.includes(o.diet as Diet) ? (o.diet as Diet) : "none",
    dislikes: Array.isArray(o.dislikes)
      ? o.dislikes.map(String).map((s) => s.trim()).filter(Boolean)
      : [],
    budgetCents: Number.isFinite(budgetCents) && budgetCents > 0 ? Math.round(budgetCents) : undefined,
  };
}

// Swap a single meal in an existing plan. Unlike /api/plan this is NOT a new
// plan generation: it's an edit to the week you already have, so it isn't
// metered against the free-tier weekly limit — only rate-limited.
export async function POST(req: Request) {
  try {
    if (!(await allow("plan", clientIp(req), 30, 60))) {
      return NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
    }
    const body = await req.json();

    const prefs = sanitizePrefs(body.prefs);
    const currentIds: number[] = Array.isArray(body.currentIds)
      ? body.currentIds.map(Number).filter((n: number) => Number.isFinite(n))
      : [];
    const swapId = Number(body.mealId);
    if (!currentIds.length || !Number.isFinite(swapId)) {
      return NextResponse.json({ error: "Bad swap request." }, { status: 400 });
    }

    // Per-meal swap is a Pro feature. Anonymous callers are the public demo
    // teaser (which shows Pro surfaces unmetered), so they're allowed; a
    // signed-in free user is gated to an upsell.
    const user = await getCurrentUser();
    if (user) {
      const ent = await getUserEntitlements(user.id);
      if (!ent.swapMeal) {
        return NextResponse.json(
          {
            error: "Swapping a single meal is a Pro feature. Upgrade for unlimited plans and per-meal swaps.",
            upgrade: true,
          },
          { status: 403 },
        );
      }
    }

    const pool = await loadPool();
    const plan = swapMeal(pool, prefs, currentIds, swapId);

    // Persist the edit onto the user's current saved plan, when we can confirm
    // ownership, so plan history + the weekly email reflect the latest state.
    let savedPlanId: string | undefined =
      typeof body.savedPlanId === "string" ? body.savedPlanId : undefined;
    if (user && savedPlanId) {
      const owned = await prisma.savedPlan.findFirst({
        where: { id: savedPlanId, userId: user.id },
        select: { id: true },
      });
      if (owned) {
        await prisma.savedPlan.update({
          where: { id: owned.id },
          data: { prefsJson: JSON.stringify(prefs), resultJson: JSON.stringify(plan) },
        });
      } else {
        savedPlanId = undefined; // not theirs (or stale) — don't echo it back
      }
    }

    return NextResponse.json({ ...plan, savedPlanId });
  } catch (e) {
    console.error("meal swap failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
