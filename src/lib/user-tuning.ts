// Read/write a user's standing meal-suggestion tuning (User.tuningJson). The plan
// routes load it and merge it into engine Preferences; the report's feedback form
// writes it. Kept separate from tuning.ts so the engine can stay free of Prisma.

import { prisma } from "@/lib/db";
import { parseTuning, serializeTuning, type MealTuning } from "@/lib/tuning";

export async function getUserTuning(userId: string): Promise<MealTuning> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { tuningJson: true } });
  return parseTuning(u?.tuningJson);
}

export async function saveUserTuning(userId: string, tuning: MealTuning): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { tuningJson: serializeTuning(tuning) } });
}
