import type { PlanResult } from "@/lib/engine";

/* eslint-disable @next/next/no-img-element */

// Read-only render of a saved week — the meals, the one grocery list, and the
// Sunday prep. Mirrors the planner's output but with no interactivity, so it can
// be a server component for plan history. The live planner (Planner.tsx) keeps
// its own copy because it layers swap/modal interactions on top.

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function SavedPlanView({ plan }: { plan: PlanResult }) {
  const totalPrepMin = plan.prep.reduce((s, b) => s + b.minutes, 0);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Weekly total" value={money(plan.totalCents)} big />
        <Stat label="Per serving" value={money(plan.perServingCents)} accent />
        <Stat label="You saved" value={money(plan.overlapSavingsCents)} />
        <Stat label="Servings made" value={String(plan.servingsProduced)} />
      </div>

      <section>
        <SectionTitle hint={`${plan.meals.length} dinners`}>The dinners</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {plan.meals.map((m) => (
            <div key={m.id} className="flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              {m.imageUrl && <img src={m.imageUrl} alt={m.title} className="h-40 w-full object-cover" />}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold leading-snug text-stone-800">{m.title}</h3>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill tone="brand">{m.protein}</Pill>
                  {m.area && <Pill tone="stone">{m.area}</Pill>}
                </div>
                {m.sharedIngredients.length > 0 && (
                  <p className="mt-3 text-xs text-stone-500">
                    <span className="font-medium text-brand-dark">Shares:</span> {m.sharedIngredients.slice(0, 5).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle hint={`${plan.distinctIngredients} items · ${money(plan.totalCents)}`}>One grocery list</SectionTitle>
        <div className="rounded-2xl border border-stone-200 bg-white shadow-sm">
          {plan.groceryAisles.map((a) => (
            <div key={a.aisle} className="border-b border-stone-100 last:border-0">
              <div className="flex items-center justify-between bg-stone-50/70 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{a.aisle}</span>
                <span className="text-xs text-stone-400">{money(a.subtotalCents)}</span>
              </div>
              <ul>
                {a.items.map((i) => (
                  <li key={i.key} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-stone-800">{i.displayName}</span>
                      <span className="text-xs text-stone-400">{i.packsNeeded > 1 ? `${i.packsNeeded} × ${i.packLabel}` : i.packLabel}</span>
                      {i.shared && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand-dark">in {i.usedByCount} meals</span>}
                    </span>
                    <span className="tabular-nums text-stone-600">{money(i.lineCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-semibold text-stone-800">Estimated total</span>
            <span className="font-display text-2xl font-black tabular-nums text-brand-dark">{money(plan.totalCents)}</span>
          </div>
        </div>
        {plan.pantryStaples.length > 0 && (
          <p className="mt-3 text-xs text-stone-500">
            <span className="font-medium text-stone-600">Pantry staples you likely had</span> (not counted): {plan.pantryStaples.join(", ")}.
          </p>
        )}
      </section>

      <section>
        <SectionTitle hint={`~${totalPrepMin} min, once`}>Sunday prep</SectionTitle>
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <ol className="space-y-4">
            {plan.prep.map((b, idx) => (
              <li key={idx} className="flex gap-4">
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand-dark">{b.minutes}m</span>
                  {idx < plan.prep.length - 1 && <span className="mt-1 w-px flex-1 bg-stone-200" />}
                </div>
                <div className="pb-1">
                  <h4 className="font-semibold text-stone-800">{b.label}</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-stone-600">
                    {b.tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, big, accent }: { label: string; value: string; big?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`mt-1 ${big ? "font-display text-3xl font-black" : "text-xl font-bold"} ${accent ? "text-accent" : "text-stone-800"}`}>{value}</div>
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

function Pill({ children, tone }: { children: React.ReactNode; tone: "brand" | "stone" }) {
  const cls = tone === "brand" ? "bg-brand/10 text-brand-dark" : "bg-stone-100 text-stone-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
