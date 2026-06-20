// Referral rewards: when a user who was referred converts to Pro, the referrer
// earns a reward. Driven from Stripe subscription webhooks; idempotent via a
// Referral row keyed (uniquely) on the referred user.
//
// Two reward shapes, chosen automatically:
//   • referrer is already a paying Pro  → a Stripe customer balance credit that
//     auto-applies to their next invoice (effectively a free month at $5/mo).
//   • referrer isn't a current subscriber → a one-time promotion code from a
//     shared coupon, emailed for them to redeem at checkout.
import { prisma } from "@/lib/db";
import { stripe, STRIPE_ENABLED } from "@/lib/stripe";
import { sendEmail, referralRewardEmail } from "@/lib/email";

const REFERRAL_COUPON_ID = "forkcast_referral_5off";
export const REFERRAL_REWARD_CENTS = 500;

// A stable, reusable coupon. Created once (with a fixed id) and reused after.
async function ensureReferralCoupon(): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");
  try {
    await stripe.coupons.retrieve(REFERRAL_COUPON_ID);
  } catch {
    await stripe.coupons.create({
      id: REFERRAL_COUPON_ID,
      amount_off: REFERRAL_REWARD_CENTS,
      currency: "usd",
      duration: "once",
      name: "Forkcast referral reward",
    });
  }
  return REFERRAL_COUPON_ID;
}

function generatePromoCode(): string {
  return `FRIEND-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/**
 * Grant the referrer their reward the first time someone they referred becomes
 * Pro. Safe to call from every subscription webhook: the Referral row makes it
 * idempotent, and a failed Stripe grant leaves the row pending so a later event
 * retries. Never throws — referral rewards must not break billing webhooks.
 */
export async function rewardReferralOnConversion(referredUserId: string): Promise<void> {
  try {
    const referred = await prisma.user.findUnique({
      where: { id: referredUserId },
      select: { id: true, referredByCode: true },
    });
    const code = referred?.referredByCode;
    if (!code) return; // wasn't referred

    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: {
        id: true,
        email: true,
        stripeCustomerId: true,
        subscription: { select: { plan: true, status: true } },
      },
    });
    if (!referrer || referrer.id === referredUserId) return; // unknown code or self-referral

    // Idempotency anchor: exactly one Referral row per referred user.
    let referral = await prisma.referral.findUnique({ where: { referredUserId } });
    if (referral?.rewardedAt) return; // already rewarded
    if (!referral) {
      try {
        referral = await prisma.referral.create({
          data: { referrerUserId: referrer.id, referredUserId, code },
        });
      } catch {
        // Lost a race to a concurrent webhook — re-read; bail if it already paid out.
        referral = await prisma.referral.findUnique({ where: { referredUserId } });
        if (!referral || referral.rewardedAt) return;
      }
    }

    if (!STRIPE_ENABLED || !stripe) {
      console.log(
        `[referral] ${referrer.id} earned a reward (referred ${referredUserId}); Stripe disabled — pending.`,
      );
      return;
    }

    const isActivePro =
      referrer.subscription?.plan === "pro" &&
      (referrer.subscription?.status === "active" || referrer.subscription?.status === "trialing");

    let rewardKind: string;
    let rewardRef: string;
    let rewardCode: string | null = null;

    if (isActivePro && referrer.stripeCustomerId) {
      const txn = await stripe.customers.createBalanceTransaction(referrer.stripeCustomerId, {
        amount: -REFERRAL_REWARD_CENTS, // negative = credit toward future invoices
        currency: "usd",
        description: "Forkcast referral reward",
      });
      rewardKind = "balance_credit";
      rewardRef = txn.id;
    } else {
      const coupon = await ensureReferralCoupon();
      const promo = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon },
        code: generatePromoCode(),
        max_redemptions: 1,
        metadata: { referrerUserId: referrer.id, referredUserId },
      });
      rewardKind = "promo_code";
      rewardRef = promo.id;
      rewardCode = promo.code;
    }

    await prisma.referral.update({
      where: { id: referral.id },
      data: { rewardKind, rewardRef, rewardCode, rewardedAt: new Date() },
    });

    if (referrer.email) {
      const { subject, html } = referralRewardEmail({
        kind: rewardKind,
        code: rewardCode,
        amountCents: REFERRAL_REWARD_CENTS,
      });
      await sendEmail({ to: referrer.email, subject, html });
    }
  } catch (e) {
    console.error("Referral reward grant failed (left pending for retry):", e);
  }
}

export interface ReferralSummary {
  joined: number; // referred users who converted to Pro
  rewardedCents: number; // total reward granted
  pending: number; // earned but not yet granted (e.g. Stripe was off)
}

/** A referrer's earned rewards, for display on the account page. */
export async function getReferralSummary(referrerUserId: string): Promise<ReferralSummary> {
  const rows = await prisma.referral.findMany({
    where: { referrerUserId },
    select: { rewardedAt: true },
  });
  const rewarded = rows.filter((r) => r.rewardedAt).length;
  return {
    joined: rows.length,
    rewardedCents: rewarded * REFERRAL_REWARD_CENTS,
    pending: rows.length - rewarded,
  };
}
