import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { getUserTuning } from "@/lib/user-tuning";
import { buildWeeklyReport, type WeeklyReport } from "@/lib/weekly-report";
import { NutritionFacts } from "@/components/Nutrition";
import ReportFeedback from "@/components/ReportFeedback";

export const metadata = { title: "Your week — Forkcast" };
export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function ReportPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect("/login?callbackUrl=/report");

  const ent = await getUserEntitlements(user.id);

  return (
    <main className="min-h-screen bg-[var(--background)]">
      <ReportHeader />
      <div className="mx-auto max-w-4xl px-5 py-8">
        {!ent.weeklyReport ? <UpsellPanel /> : <ReportBody userId={user.id} />}
      </div>
    </main>
  );
}

async function ReportBody({ userId }: { userId: string }) {
  const [report, tuning] = await Promise.all([buildWeeklyReport(userId), getUserTuning(userId)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-stone-800">Your week</h1>
          {report && <p className="mt-1 text-sm text-stone-500">{report.rangeLabel}</p>}
        </div>
        <Link href="/app" className="text-sm font-medium text-stone-500 transition hover:text-brand-dark">
          New plan →
        </Link>
      </div>

      {!report ? (
        <EmptyState />
      ) : (
        <>
          <FinancialOverview report={report} />
          <NutritionOverview report={report} />
        </>
      )}

      <ReportFeedback initial={tuning} />
    </div>
  );
}

function FinancialOverview({ report }: { report: WeeklyReport }) {
  const { spend } = report;
  return (
    <section>
      <SectionTitle hint={`${report.planCount} plan${report.planCount > 1 ? "s" : ""} · ${report.dinners} dinners`}>
        What you spent
      </SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Groceries" value={money(spend.totalCents)} big />
        <Stat label="Per serving" value={money(spend.perServingCents)} accent />
        <Stat label="Saved by overlap" value={money(spend.savingsCents)} />
        <Stat
          label="vs. last week"
          value={spend.deltaCents == null ? "—" : `${spend.deltaCents <= 0 ? "−" : "+"}${money(Math.abs(spend.deltaCents))}`}
          tone={spend.deltaCents == null ? undefined : spend.deltaCents <= 0 ? "good" : "bad"}
        />
      </div>

      {report.aisleSpend.length > 0 && (
        <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Where it went</div>
          <div className="mt-3 space-y-2">
            {report.aisleSpend.map((a) => {
              const pct = report.spend.totalCents ? Math.round((a.cents / report.spend.totalCents) * 100) : 0;
              return (
                <div key={a.aisle} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-stone-600">{a.aisle}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                    <span className="block h-full rounded-full bg-brand/50" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-16 shrink-0 text-right text-sm tabular-nums text-stone-600">{money(a.cents)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function NutritionOverview({ report }: { report: WeeklyReport }) {
  if (!report.nutrition) {
    return (
      <section>
        <SectionTitle>What you ate</SectionTitle>
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 p-6 text-center text-sm text-stone-500">
          Nutrition shows up here once you generate a new plan — every dinner now comes with a full USDA breakdown.
        </div>
      </section>
    );
  }

  const n = report.nutrition;
  return (
    <section>
      <SectionTitle hint={`from ${n.mealsCovered} of ${n.totalMeals} dinners`}>What you ate</SectionTitle>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-stone-600">
          Across {report.dinners} dinners, your household ate about{" "}
          <strong className="text-stone-800">{Math.round(n.weekly.kcal).toLocaleString()} calories</strong>,{" "}
          <strong className="text-stone-800">{Math.round(n.weekly.protein)}g protein</strong>, and{" "}
          <strong className="text-stone-800">{Math.round(n.weekly.fiber)}g fiber</strong>.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {report.topProteins.map((p) => (
            <span key={p.label} className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand-dark">
              {p.label} ×{p.count}
            </span>
          ))}
        </div>

        <div className="mt-5 border-t border-stone-100 pt-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">Average per dinner serving</div>
          <NutritionFacts panel={n.perServing} note="Averaged across this week's dinners; estimated from USDA data." />
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 p-10 text-center">
      <p className="font-display text-lg font-bold text-stone-700">No plans yet this week</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-stone-500">
        Plan a week and your spend + nutrition recap shows up here. You can still set your preferences below.
      </p>
      <Link
        href="/app"
        className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        Plan this week
      </Link>
    </div>
  );
}

function UpsellPanel() {
  return (
    <>
      <h1 className="font-display text-3xl font-black tracking-tight text-stone-800">Your week</h1>
      <div className="mt-6 rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-accent/5 p-8 text-center shadow-sm">
        <div className="text-2xl" aria-hidden>
          📊
        </div>
        <p className="mt-2 font-display text-xl font-bold tracking-tight text-stone-800">See your week at a glance</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
          Pro gives you a weekly recap — what you spent and a full nutrition breakdown of what you ate — plus feedback
          controls that tune every future plan toward more protein, fewer noodles, or whatever you like.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Upgrade to Pro — $5/mo
        </Link>
      </div>
    </>
  );
}

function ReportHeader() {
  return (
    <header className="border-b border-stone-200/70 bg-[var(--background)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
        <Link href="/app" className="font-display text-xl font-black tracking-tight text-brand-dark">
          Forkcast
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium text-stone-500">
          <Link href="/history" className="transition hover:text-brand-dark">
            History
          </Link>
          <Link href="/account" className="transition hover:text-brand-dark">
            Account
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Stat({ label, value, big, accent, tone }: { label: string; value: string; big?: boolean; accent?: boolean; tone?: "good" | "bad" }) {
  const valueColor = tone === "good" ? "text-brand-dark" : tone === "bad" ? "text-red-600" : accent ? "text-accent" : "text-stone-800";
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`mt-1 ${big ? "font-display text-3xl font-black" : "text-xl font-bold"} ${valueColor}`}>{value}</div>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="font-display text-xl font-bold tracking-tight text-stone-800">{children}</h2>
      {hint && <span className="text-xs text-stone-400">{hint}</span>}
    </div>
  );
}
