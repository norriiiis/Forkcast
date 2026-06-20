import { prisma } from "@/lib/db";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How many plans this user has generated in the last rolling 7 days. */
export async function weeklyPlanCount(userId: string): Promise<number> {
  const since = new Date(Date.now() - WEEK_MS);
  return prisma.planGenerationLog.count({
    where: { userId, createdAt: { gte: since } },
  });
}
