import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, syncSubscription } from "@/lib/stripe";
import { rewardReferralOnConversion } from "@/lib/referrals";
import { sendEmail, dunningEmail } from "@/lib/email";

// Stripe statuses that mean the customer is a paying (or trialing) Pro.
function isActive(status: Stripe.Subscription.Status): boolean {
  return status === "active" || status === "trialing";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe webhook: the authoritative path that flips entitlements. Signature-
// verified; each handler is idempotent (syncSubscription upserts by userId).
export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = req.headers.get("stripe-signature");
  if (!secret || !sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    console.error("Stripe signature verification failed:", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const userId = await syncSubscription(sub);
          // First conversion to Pro — reward whoever referred them (idempotent).
          if (userId && isActive(sub.status)) await rewardReferralOnConversion(userId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const userId = await syncSubscription(sub);
        if (userId && isActive(sub.status)) await rewardReferralOnConversion(userId);
        break;
      }
      case "customer.subscription.deleted": {
        await syncSubscription(event.data.object);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { customer_email?: string | null };
        if (invoice.customer_email) {
          const { subject, html } = dunningEmail();
          await sendEmail({ to: invoice.customer_email, subject, html });
        }
        break;
      }
    }
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
