import Stripe from "stripe";
import { prisma } from "@/lib/db";

// Stripe is optional locally: when STRIPE_SECRET_KEY is absent the billing UI
// falls back to a dev "simulate Pro" path so entitlement gating can be exercised
// without keys. With keys present, the real Checkout/Portal/webhook flow runs.
export const STRIPE_ENABLED = Boolean(process.env.STRIPE_SECRET_KEY);
export const stripe = STRIPE_ENABLED ? new Stripe(process.env.STRIPE_SECRET_KEY!) : null;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function getOrCreateCustomerId(userId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function createCheckoutSession(userId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");
  const price = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!price) throw new Error("STRIPE_PRICE_PRO_MONTHLY not set");
  const customer = await getOrCreateCustomerId(userId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${APP_URL}/account?upgraded=1`,
    cancel_url: `${APP_URL}/pricing`,
    subscription_data: { metadata: { userId } },
  });
  if (!session.url) throw new Error("No checkout URL");
  return session.url;
}

export async function createPortalSession(userId: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.stripeCustomerId) throw new Error("No Stripe customer");
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${APP_URL}/account`,
  });
  return session.url;
}

async function userIdForSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const metaUserId = sub.metadata?.userId;
  if (metaUserId) return metaUserId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
  return user?.id ?? null;
}

// Mirror a Stripe subscription into our Subscription row — the source of truth
// for entitlements. Called from webhooks. Period-end is read defensively because
// recent Stripe API versions moved it onto subscription items. Returns the
// resolved userId (or null) so callers can trigger downstream effects.
export async function syncSubscription(sub: Stripe.Subscription): Promise<string | null> {
  const userId = await userIdForSubscription(sub);
  if (!userId) return null;
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id ?? null;
  const rawPeriodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;
  const plan = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
  const data = {
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    plan,
    currentPeriodEnd: rawPeriodEnd ? new Date(rawPeriodEnd * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
  };
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return userId;
}
