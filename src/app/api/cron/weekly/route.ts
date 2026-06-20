import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadPool, buildPlan, type Preferences } from "@/lib/engine";
import { sendEmail, weeklyPlanEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Weekly plan email for Pro subscribers. Triggered by Vercel Cron (see
// vercel.json), which sends Authorization: Bearer ${CRON_SECRET}.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subs = await prisma.subscription.findMany({
    where: { plan: "pro", status: { in: ["active", "trialing"] } },
    include: { user: { select: { email: true } } },
  });
  if (!subs.length) return NextResponse.json({ sent: 0 });

  const pool = await loadPool();
  const prefs: Preferences = { servings: 2, nights: 5, diet: "none", dislikes: [] };
  let sent = 0;

  for (const sub of subs) {
    const email = sub.user.email;
    if (!email) continue;
    try {
      const plan = buildPlan(pool, prefs, Math.floor(Math.random() * 5));
      if (!plan.meals.length) continue;
      await prisma.savedPlan.create({
        data: {
          userId: sub.userId,
          prefsJson: JSON.stringify(prefs),
          resultJson: JSON.stringify(plan),
          weekOf: new Date(),
        },
      });
      const { subject, html } = weeklyPlanEmail(plan);
      await sendEmail({ to: email, subject, html });
      sent++;
    } catch (e) {
      console.error("weekly email failed for", email, e);
    }
  }

  return NextResponse.json({ sent });
}
