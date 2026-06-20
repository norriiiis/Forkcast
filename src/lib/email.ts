import { Resend } from "resend";
import type { PlanResult } from "@/lib/engine";

// Email is optional locally: without RESEND_API_KEY, sends are logged, not sent.
export const EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY);
const resend = EMAIL_ENABLED ? new Resend(process.env.RESEND_API_KEY!) : null;
const FROM = process.env.EMAIL_FROM || "Forkcast <hello@forkcast.app>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.log(`[email:dev] to=${opts.to} subject="${opts.subject}" (RESEND_API_KEY not set — not sent)`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
  } catch (e) {
    console.error("Email send failed:", e);
  }
}

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function shell(body: string): string {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#fbf8f2;padding:32px 0;color:#1c1917">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #d8e3d4;border-radius:20px;overflow:hidden">
      <div style="padding:20px 28px;border-bottom:1px solid #eef3ea">
        <span style="font-family:Georgia,serif;font-weight:800;font-size:20px;color:#14532d">Forkcast</span>
      </div>
      <div style="padding:28px">${body}</div>
      <div style="padding:18px 28px;border-top:1px solid #eef3ea;font-size:12px;color:#6f6a64">
        Plan once. Eat all week. · <a href="${APP_URL}" style="color:#15803d">forkcast.app</a>
      </div>
    </div>
  </div>`;
}

export function welcomeEmail(name?: string | null): { subject: string; html: string } {
  return {
    subject: "Welcome to Forkcast 🍽️",
    html: shell(`
      <h1 style="font-family:Georgia,serif;font-size:24px;margin:0 0 12px">Dinner, decided.</h1>
      <p style="line-height:1.6;color:#44403c">Hi ${name || "there"} — welcome in. Set your preferences once and Forkcast hands you a week of overlapping dinners, one aisle-sorted grocery list, and a 90-minute Sunday prep.</p>
      <p style="margin:24px 0"><a href="${APP_URL}/app" style="background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Plan my week →</a></p>
      <p style="line-height:1.6;color:#6f6a64;font-size:14px">Upgrade to Pro any time for the cheapest store near you and a plan emailed every week.</p>
    `),
  };
}

export function weeklyPlanEmail(plan: PlanResult): { subject: string; html: string } {
  const meals = plan.meals
    .map(
      (m) =>
        `<li style="margin:6px 0;color:#1c1917"><strong>${m.title}</strong> <span style="color:#6f6a64">· ${m.protein}</span></li>`,
    )
    .join("");
  return {
    subject: `This week: ${plan.meals.length} dinners for ${money(plan.totalCents)}`,
    html: shell(`
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 6px">This week's plan</h1>
      <p style="color:#6f6a64;margin:0 0 16px">${plan.meals.length} dinners · ${money(plan.totalCents)} · ${money(plan.perServingCents)}/serving</p>
      <ul style="padding-left:18px;margin:0 0 20px">${meals}</ul>
      <p style="margin:8px 0 24px"><a href="${APP_URL}/app" style="background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Open your full plan + grocery list →</a></p>
    `),
  };
}

export function referralRewardEmail(opts: {
  kind: string;
  code: string | null;
  amountCents: number;
}): { subject: string; html: string } {
  const amount = money(opts.amountCents);
  const detail =
    opts.kind === "promo_code" && opts.code
      ? `<p style="line-height:1.6;color:#44403c">Use this code at checkout for ${amount} off Forkcast Pro:</p>
         <p style="margin:14px 0"><span style="display:inline-block;background:#f0f6ec;border:1px dashed #15803d;border-radius:10px;padding:10px 18px;font-family:Menlo,monospace;font-size:18px;font-weight:700;color:#14532d;letter-spacing:1px">${opts.code}</span></p>`
      : `<p style="line-height:1.6;color:#44403c">We've added <strong>${amount} in credit</strong> to your account — it applies automatically to your next invoice.</p>`;
  return {
    subject: `You earned ${amount} off Forkcast 🎉`,
    html: shell(`
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">Someone you invited just joined</h1>
      <p style="line-height:1.6;color:#44403c">Thanks for spreading the word about Forkcast. As a little thank-you, here's ${amount} off.</p>
      ${detail}
      <p style="margin:24px 0"><a href="${APP_URL}/account" style="background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Go to your account →</a></p>
    `),
  };
}

export function dunningEmail(): { subject: string; html: string } {
  return {
    subject: "Your Forkcast payment didn't go through",
    html: shell(`
      <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px">A quick heads up</h1>
      <p style="line-height:1.6;color:#44403c">We couldn't process your latest Forkcast Pro payment. Update your card to keep unlimited plans and the cheapest-store search.</p>
      <p style="margin:24px 0"><a href="${APP_URL}/account" style="background:#15803d;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Update billing →</a></p>
    `),
  };
}
