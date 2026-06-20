import { prisma } from "@/lib/db";
import type { PlanResult, Diet } from "@/lib/engine";

export interface SavedPlanRecord {
  id: string;
  weekOf: Date | null;
  createdAt: Date;
  plan: PlanResult;
}

function parse(row: { id: string; weekOf: Date | null; createdAt: Date; resultJson: string }): SavedPlanRecord | null {
  try {
    const plan = JSON.parse(row.resultJson) as PlanResult;
    if (!plan?.meals?.length) return null; // skip empty/corrupt rows
    return { id: row.id, weekOf: row.weekOf, createdAt: row.createdAt, plan };
  } catch {
    return null;
  }
}

/** A user's saved weeks, newest first. */
export async function listSavedPlans(userId: string, take = 50): Promise<SavedPlanRecord[]> {
  const rows = await prisma.savedPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, weekOf: true, createdAt: true, resultJson: true },
  });
  return rows.map(parse).filter((r): r is SavedPlanRecord => r !== null);
}

/** A single saved week, scoped to its owner (returns null if not theirs). */
export async function getSavedPlan(userId: string, id: string): Promise<SavedPlanRecord | null> {
  const row = await prisma.savedPlan.findFirst({
    where: { id, userId },
    select: { id: true, weekOf: true, createdAt: true, resultJson: true },
  });
  return row ? parse(row) : null;
}

const DIET_LABEL: Record<Diet, string> = {
  none: "Anything",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
};

export function dietLabel(diet: string): string {
  return DIET_LABEL[diet as Diet] ?? "Anything";
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

export function planDateLabel(rec: SavedPlanRecord): string {
  return DATE_FMT.format(rec.weekOf ?? rec.createdAt);
}
