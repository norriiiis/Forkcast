"use client";

import { useState, useTransition } from "react";
import { updateTuning } from "@/app/actions/tuning";
import { CUISINE_OPTIONS, type Emphasis, type MealTuning } from "@/lib/tuning";

// The weekly-report feedback panel: preset toggles that become the user's standing
// meal-suggestion tuning, applied to every future plan.
export default function ReportFeedback({ initial }: { initial: MealTuning }) {
  const [tuning, setTuning] = useState<MealTuning>(initial);
  const [saved, setSaved] = useState<MealTuning | null>(initial);
  const [pending, startTransition] = useTransition();

  const dirty = JSON.stringify(tuning) !== JSON.stringify(saved);

  function set<K extends keyof MealTuning>(key: K, value: MealTuning[K]) {
    setTuning((t) => ({ ...t, [key]: value }));
  }
  function toggleCuisine(c: string, bucket: "preferCuisines" | "avoidCuisines") {
    setTuning((t) => {
      const other = bucket === "preferCuisines" ? "avoidCuisines" : "preferCuisines";
      const inBucket = t[bucket].includes(c);
      return {
        ...t,
        [bucket]: inBucket ? t[bucket].filter((x) => x !== c) : [...t[bucket], c],
        [other]: t[other].filter((x) => x !== c), // a cuisine sits in at most one bucket
      };
    });
  }

  function save() {
    startTransition(async () => {
      const res = await updateTuning(tuning);
      if (res.ok) setSaved(tuning);
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight text-stone-800">Tune next week</h2>
      <p className="mt-1 text-sm text-stone-500">
        Tell Forkcast what to shift. These stick to every plan you make until you change them.
      </p>

      <div className="mt-5 space-y-5">
        <Row label="Protein" hint="Lean toward higher- or lower-protein dinners">
          <Tri value={tuning.protein} onChange={(v) => set("protein", v)} less="Less" more="More" />
        </Row>
        <Row label="Noodles & carbs" hint="Fewer pasta / rice / noodle nights, or more">
          <Tri value={tuning.carbs} onChange={(v) => set("carbs", v)} less="Fewer" more="More" />
        </Row>
        <Row label="Vegetables" hint="Favor more vegetable-forward dinners">
          <Toggle on={tuning.veggies === "more"} onChange={(on) => set("veggies", on ? "more" : "off")} label="More veggies" />
        </Row>
        <Row label="Variety" hint="Repeat proteins and dish styles less across the week">
          <Toggle on={tuning.variety === "more"} onChange={(on) => set("variety", on ? "more" : "off")} label="More variety" />
        </Row>
        <Row label="Budget" hint="Weight cheaper ingredients more heavily">
          <Toggle on={tuning.cheaper} onChange={(on) => set("cheaper", on)} label="Prioritize cheaper" />
        </Row>

        <div>
          <div className="text-sm font-medium text-stone-700">Cuisines</div>
          <p className="mt-0.5 text-xs text-stone-400">Tap once to lean in, twice to cut back.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CUISINE_OPTIONS.map((c) => {
              const prefer = tuning.preferCuisines.includes(c);
              const avoid = tuning.avoidCuisines.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCuisine(c, prefer ? "avoidCuisines" : avoid ? "avoidCuisines" : "preferCuisines")}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    prefer
                      ? "border-brand bg-brand text-white"
                      : avoid
                        ? "border-red-300 bg-red-50 text-red-600 line-through"
                        : "border-stone-300 bg-white text-stone-600 hover:border-brand/40"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || pending}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save preferences"}
        </button>
        {!dirty && saved && <span className="text-sm font-medium text-brand-dark">Saved ✓</span>}
        {dirty && <span className="text-sm text-stone-400">Unsaved changes</span>}
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4 last:border-0 last:pb-0">
      <div>
        <div className="text-sm font-medium text-stone-700">{label}</div>
        <div className="text-xs text-stone-400">{hint}</div>
      </div>
      {children}
    </div>
  );
}

// Tri-state segmented control: less | balanced | more.
function Tri({ value, onChange, less, more }: { value: Emphasis; onChange: (v: Emphasis) => void; less: string; more: string }) {
  const opts: { v: Emphasis; label: string }[] = [
    { v: "less", label: less },
    { v: "off", label: "Balanced" },
    { v: "more", label: more },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            value === o.v ? "border-brand bg-brand text-white shadow-sm" : "border-stone-300 bg-white text-stone-600 hover:border-brand/40"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
        on ? "border-brand bg-brand text-white shadow-sm" : "border-stone-300 bg-white text-stone-600 hover:border-brand/40"
      }`}
    >
      {label}
    </button>
  );
}
