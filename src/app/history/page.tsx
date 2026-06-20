import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { listSavedPlans, dietLabel, planDateLabel } from "@/lib/saved-plans";

export const metadata = { title: "Plan history — Forkcast" };
export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/* eslint-disable @next/next/no-img-element */

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect("/login?callbackUrl=/history");

  const ent = await getUserEntitlements(user.id);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <HistoryHeader />
      <div className="mx-auto max-w-4xl px-5 py-8">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-3xl font-black tracking-tight text-stone-800">Plan history</h1>
          <Link href="/app" className="text-sm font-medium text-stone-500 transition hover:text-brand-dark">
            New plan →
          </Link>
        </div>

        {!ent.planHistory ? (
          <UpsellPanel />
        ) : (
          <PlanList userId={user.id} />
        )}
      </div>
    </main>
  );
}

async function PlanList({ userId }: { userId: string }) {
  const plans = await listSavedPlans(userId);

  if (plans.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/50 p-10 text-center">
        <p className="font-display text-lg font-bold text-stone-700">No saved plans yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
          Every week you plan is saved here so you can revisit the dinners, grocery list, and prep.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Plan your first week
        </Link>
      </div>
    );
  }

  return (
    <ul className="mt-6 space-y-4">
      {plans.map((rec) => {
        const p = rec.plan;
        const prefs = p.preferences;
        return (
          <li key={rec.id}>
            <Link
              href={`/history/${rec.id}`}
              className="block rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-brand/40 hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">{planDateLabel(rec)}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Chip>{prefs.nights} dinners</Chip>
                    <Chip>{prefs.servings === 1 ? "1 person" : `${prefs.servings} people`}</Chip>
                    <Chip>{dietLabel(prefs.diet)}</Chip>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl font-black tabular-nums text-brand-dark">{money(p.totalCents)}</div>
                  {p.overlapSavingsCents > 0 && (
                    <div className="text-xs font-medium text-accent">saved {money(p.overlapSavingsCents)}</div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3 overflow-hidden">
                <div className="flex -space-x-3">
                  {p.meals.slice(0, 5).map((m) =>
                    m.imageUrl ? (
                      <img
                        key={m.id}
                        src={m.imageUrl}
                        alt=""
                        className="h-11 w-11 rounded-full border-2 border-white object-cover shadow-sm"
                      />
                    ) : (
                      <div key={m.id} className="h-11 w-11 rounded-full border-2 border-white bg-stone-100" />
                    ),
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-stone-600">
                  {p.meals.map((m) => m.title).join(" · ")}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function UpsellPanel() {
  return (
    <div className="mt-8 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-accent/5 p-8 text-center shadow-sm">
      <div className="text-2xl" aria-hidden>📚</div>
      <p className="mt-2 font-display text-xl font-bold tracking-tight text-stone-800">Keep every week you plan</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
        Pro saves each plan — the dinners, the grocery list, and the Sunday prep — so you can revisit a week you loved
        or reorder the same haul.
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Upgrade to Pro — $5/mo
      </Link>
    </div>
  );
}

function HistoryHeader() {
  return (
    <header className="border-b border-stone-200/70 bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
        <Link href="/app" className="font-display text-xl font-black tracking-tight text-brand-dark">
          Forkcast
        </Link>
        <Link href="/account" className="text-sm font-medium text-stone-500 transition hover:text-brand-dark">
          Account
        </Link>
      </div>
    </header>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-600">{children}</span>;
}
