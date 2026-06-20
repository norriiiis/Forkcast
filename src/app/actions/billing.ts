"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createCheckoutSession, createPortalSession } from "@/lib/stripe";

/** Start a Stripe Checkout session for the Pro plan and redirect to it. */
export async function startCheckout() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/pricing");
  const url = await createCheckoutSession(session.user.id);
  redirect(url);
}

/** Open the Stripe Billing Portal for the current user. */
export async function openBillingPortal() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const url = await createPortalSession(session.user.id);
  redirect(url);
}

// ---- Dev-only: flip Pro without Stripe, to exercise entitlement gating locally.
// No-ops in production.
export async function devEnablePro() {
  if (process.env.NODE_ENV === "production") return;
  await devSetPlan(true);
}
export async function devDisablePro() {
  if (process.env.NODE_ENV === "production") return;
  await devSetPlan(false);
}

async function devSetPlan(pro: boolean) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: pro ? "pro" : "free",
      status: pro ? "active" : "canceled",
    },
    update: { plan: pro ? "pro" : "free", status: pro ? "active" : "canceled" },
  });
  revalidatePath("/account");
  revalidatePath("/pricing");
  revalidatePath("/app");
}
