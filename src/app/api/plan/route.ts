import { NextResponse } from "next/server";
import { generatePlan, type Diet, type Preferences } from "@/lib/engine";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { getUserTuning } from "@/lib/user-tuning";
import { weeklyPlanCount } from "@/lib/usage";
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

export async function POST(req: Request) {
  try {
    if (!(await allow("plan", clientIp(req), 30, 60))) {
      return NextResponse.json({ error: "Too many requests — slow down a moment." }, { status: 429 });
    }
    const body = await req.json();

    const dislikesRaw = body.dislikes;
    const dislikes: string[] = Array.isArray(dislikesRaw)
      ? dislikesRaw.map(String)
      : typeof dislikesRaw === "string"
        ? dislikesRaw.split(",")
        : [];

    const budgetCents = body.budget ? Math.round(Number(body.budget) * 100) : undefined;

    const prefs: Preferences = {
      servings: clamp(Number(body.servings), 1, 8),
      nights: clamp(Number(body.nights), 3, 6),
      diet: DIETS.includes(body.diet) ? body.diet : "none",
      dislikes: dislikes.map((d) => d.trim()).filter(Boolean),
      budgetCents: budgetCents && budgetCents > 0 ? budgetCents : undefined,
    };

    // Signed-in users are metered by entitlements; anonymous use (the public demo
    // teaser) is unlimited. Free users get a rolling weekly plan limit.
    const user = await getCurrentUser();
    if (user) {
      // Apply the user's standing feedback (more protein, fewer noodles, …).
      prefs.tuning = await getUserTuning(user.id);
      const ent = await getUserEntitlements(user.id);
      if (ent.weeklyPlanLimit !== null) {
        const used = await weeklyPlanCount(user.id);
        if (used >= ent.weeklyPlanLimit) {
          return NextResponse.json(
            {
              error: "You've used your free plan this week. Upgrade to Pro for unlimited plans.",
              limitReached: true,
            },
            { status: 403 },
          );
        }
      }
    }

    const anchorIndex = clamp(Number(body.anchorIndex), 0, 50);
    const plan = await generatePlan(prefs, anchorIndex);

    // Persist for signed-in users: usage metering + plan history. The saved id
    // is returned so the client can target this plan for per-meal swaps.
    let savedPlanId: string | undefined;
    if (user) {
      await prisma.planGenerationLog.create({ data: { userId: user.id } });
      const saved = await prisma.savedPlan.create({
        data: {
          userId: user.id,
          prefsJson: JSON.stringify(prefs),
          resultJson: JSON.stringify(plan),
          weekOf: new Date(),
        },
        select: { id: true },
      });
      savedPlanId = saved.id;
    }

    return NextResponse.json({ ...plan, savedPlanId });
  } catch (e) {
    console.error("plan generation failed:", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
