"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { saveUserTuning } from "@/lib/user-tuning";
import { parseTuning, type MealTuning } from "@/lib/tuning";

// Save the weekly-report feedback as the user's standing meal-suggestion tuning.
// Pro-gated (the report is a Pro surface); the input is re-validated server-side.
export async function updateTuning(input: MealTuning): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };

  const ent = await getUserEntitlements(session.user.id);
  if (!ent.weeklyReport) return { ok: false };

  const clean = parseTuning(JSON.stringify(input));
  await saveUserTuning(session.user.id, clean);

  revalidatePath("/report");
  revalidatePath("/app");
  return { ok: true };
}
