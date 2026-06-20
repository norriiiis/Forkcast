import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { weeklyPlanCount } from "@/lib/usage";
import { prisma } from "@/lib/db";
import Planner from "@/components/Planner";

export const metadata = { title: "Your week — Forkcast" };

// The signed-in product. proxy.ts gives an optimistic redirect; this is the
// authoritative auth check.
export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect("/login?callbackUrl=/app");

  const ent = await getUserEntitlements(user.id);
  const weeklyUsed = ent.weeklyPlanLimit !== null ? await weeklyPlanCount(user.id) : 0;
  const addresses = ent.cheapestStore
    ? await prisma.address.findMany({
        where: { userId: user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { id: true, label: true },
      })
    : [];

  return (
    <Planner
      mode="app"
      isPro={ent.isPro}
      weeklyLimit={ent.weeklyPlanLimit}
      weeklyUsed={weeklyUsed}
      accountEmail={user.email ?? null}
      addresses={addresses}
    />
  );
}
