import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { getSavedPlan, dietLabel, planDateLabel } from "@/lib/saved-plans";
import SavedPlanView from "@/components/SavedPlanView";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  void id;
  return { title: "A saved week — Forkcast" };
}

export default async function HistoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user?.id) redirect(`/login?callbackUrl=/history/${id}`);

  // Plan history is a Pro feature; bounce free users to the gated list page.
  const ent = await getUserEntitlements(user.id);
  if (!ent.planHistory) redirect("/history");

  const rec = await getSavedPlan(user.id, id);
  if (!rec) notFound();

  const prefs = rec.plan.preferences;

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-stone-200/70 bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Link href="/history" className="text-sm font-medium text-stone-500 transition hover:text-brand-dark">
            ← All plans
          </Link>
          <Link href="/app" className="text-sm font-medium text-stone-500 transition hover:text-brand-dark">
            New plan →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{planDateLabel(rec)}</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight text-stone-800">This week&apos;s plan</h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{prefs.nights} dinners</Chip>
          <Chip>{prefs.servings === 1 ? "1 person" : `${prefs.servings} people`}</Chip>
          <Chip>{dietLabel(prefs.diet)}</Chip>
          {prefs.dislikes.length > 0 && <Chip>no {prefs.dislikes.join(", ")}</Chip>}
        </div>

        <div className="mt-8">
          <SavedPlanView plan={rec.plan} />
        </div>
      </div>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{children}</span>;
}
