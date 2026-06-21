// Builds the data for the weekly report (/report): a retrospective over the plans a
// user saved this week — what they spent and (USDA-sourced) what they ate — plus the
// numbers the feedback form uses to tune next week. Reads saved plans only; all the
// nutrition is already baked into each PlannedMeal at generation time.

import { prisma } from "@/lib/db";
import type { PlanResult } from "@/lib/engine";
import { type NutritionPanel, emptyPanel, addPanels, scalePanel, roundPanel } from "@/lib/nutrition";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyReport {
  rangeLabel: string;
  usingLatestFallback: boolean; // true when nothing was planned in the last 7 days
  planCount: number;
  dinners: number;
  servings: number;
  spend: {
    totalCents: number;
    perServingCents: number;
    savingsCents: number;
    prevTotalCents: number | null;
    deltaCents: number | null; // this week − prior week
  };
  aisleSpend: { aisle: string; cents: number }[];
  nutrition: {
    weekly: NutritionPanel; // total across the week (whole household)
    perServing: NutritionPanel; // average per dinner serving
    mealsCovered: number;
    totalMeals: number;
  } | null;
  topProteins: { label: string; count: number }[];
}

function parsePlan(json: string): PlanResult | null {
  try {
    const p = JSON.parse(json) as PlanResult;
    return p?.meals?.length ? p : null;
  } catch {
    return null;
  }
}

const RANGE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export async function buildWeeklyReport(userId: string): Promise<WeeklyReport | null> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK_MS);

  const recent = await prisma.savedPlan.findMany({
    where: { userId, createdAt: { gte: twoWeeksAgo } },
    orderBy: { createdAt: "desc" },
    select: { resultJson: true, createdAt: true },
  });

  // This week's plans (last 7 days); if there are none, fall back to the single most
  // recent plan so the report still has something to show.
  let thisWeek = recent.filter((r) => r.createdAt >= weekAgo);
  let usingLatestFallback = false;
  if (thisWeek.length === 0) {
    const latest = await prisma.savedPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { resultJson: true, createdAt: true },
    });
    if (!latest) return null;
    thisWeek = [latest];
    usingLatestFallback = true;
  }
  const priorWeek = usingLatestFallback ? [] : recent.filter((r) => r.createdAt < weekAgo);

  const plans = thisWeek.map((r) => parsePlan(r.resultJson)).filter((p): p is PlanResult => p !== null);
  if (plans.length === 0) return null;

  // ---- Spend ----
  const totalCents = plans.reduce((s, p) => s + p.totalCents, 0);
  const savingsCents = plans.reduce((s, p) => s + p.overlapSavingsCents, 0);
  const servingsProduced = plans.reduce((s, p) => s + p.servingsProduced, 0);
  const dinners = plans.reduce((s, p) => s + p.meals.length, 0);
  const perServingCents = servingsProduced ? Math.round(totalCents / servingsProduced) : 0;

  const priorPlans = priorWeek.map((r) => parsePlan(r.resultJson)).filter((p): p is PlanResult => p !== null);
  const prevTotalCents = priorPlans.length ? priorPlans.reduce((s, p) => s + p.totalCents, 0) : null;
  const deltaCents = prevTotalCents != null ? totalCents - prevTotalCents : null;

  // ---- Spend by aisle ----
  const aisleMap = new Map<string, number>();
  for (const p of plans) {
    for (const a of p.groceryAisles) aisleMap.set(a.aisle, (aisleMap.get(a.aisle) ?? 0) + a.subtotalCents);
  }
  const aisleSpend = [...aisleMap.entries()]
    .map(([aisle, cents]) => ({ aisle, cents }))
    .sort((a, b) => b.cents - a.cents);

  // ---- Nutrition: weekly household total + per-serving average ----
  // Each dinner feeds `servings` people once, so weekly intake sums (per-serving ×
  // that plan's servings) over every meal we had data for.
  let weekly = emptyPanel();
  const perServingPanels: NutritionPanel[] = [];
  let mealsCovered = 0;
  let totalMeals = 0;
  for (const p of plans) {
    const servings = Math.max(1, p.preferences?.servings ?? 2);
    for (const m of p.meals) {
      totalMeals++;
      if (!m.nutrition) continue;
      mealsCovered++;
      weekly = addPanels(weekly, scalePanel(m.nutrition, servings));
      perServingPanels.push(m.nutrition);
    }
  }
  const nutrition = perServingPanels.length
    ? {
        weekly: roundPanel(weekly),
        perServing: roundPanel(scalePanel(perServingPanels.reduce((a, b) => addPanels(a, b), emptyPanel()), 1 / perServingPanels.length)),
        mealsCovered,
        totalMeals,
      }
    : null;

  // ---- Top proteins ----
  const protMap = new Map<string, number>();
  for (const p of plans) for (const m of p.meals) protMap.set(m.protein, (protMap.get(m.protein) ?? 0) + 1);
  const topProteins = [...protMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const servings = Math.max(1, plans[0].preferences?.servings ?? 2);
  const rangeLabel = usingLatestFallback
    ? "Your latest plan"
    : `${RANGE_FMT.format(weekAgo)} – ${RANGE_FMT.format(now)}`;

  return {
    rangeLabel,
    usingLatestFallback,
    planCount: plans.length,
    dinners,
    servings,
    spend: { totalCents, perServingCents, savingsCents, prevTotalCents, deltaCents },
    aisleSpend,
    nutrition,
    topProteins,
  };
}
