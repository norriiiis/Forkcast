"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlanResult, PlannedMeal } from "@/lib/engine";
import { LOCATION_OPTIONS, DEFAULT_LOCATION_ID, SEARCH_RADIUS_MI, type StoreRanking } from "@/lib/store-pricing";

/* eslint-disable @next/next/no-img-element */

const DIET_OPTIONS = [
  { value: "none", label: "Anything" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
] as const;

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const LOCATION_KEY = "forkcast.location";

// A store ranking, normalized across the two backends: the public metro-based
// /api/stores (demo) and the address-based /api/stores/nearby (Pro, real prices).
type NormalizedStore = {
  id: string;
  name: string;
  chain: string;
  tag: string;
  distanceMi: number;
  totalCents: number;
  bestAisle: string | null;
  source?: "real" | "estimated";
};
type NormalizedRanking = {
  label: string;
  radiusMi: number;
  withinCount: number;
  excludedCount: number;
  ranked: NormalizedStore[];
  cheapest: NormalizedStore | null;
  priciest: NormalizedStore | null;
  saveCents: number;
  realCount: number;
};

function normalizeMetro(d: StoreRanking): NormalizedRanking {
  return {
    label: d.locationLabel,
    radiusMi: d.radiusMi,
    withinCount: d.withinCount,
    excludedCount: d.excludedCount,
    ranked: d.ranked,
    cheapest: d.cheapest,
    priciest: d.priciest,
    saveCents: d.saveCents,
    realCount: 0,
  };
}

type NearbyResult = {
  addressLabel?: string;
  radiusMi: number;
  withinCount: number;
  ranked: NormalizedStore[];
  cheapest: NormalizedStore | null;
  priciest: NormalizedStore | null;
  saveCents: number;
  realCount: number;
};
function normalizeNearby(d: NearbyResult): NormalizedRanking {
  return {
    label: d.addressLabel ?? "you",
    radiusMi: d.radiusMi,
    withinCount: d.withinCount,
    excludedCount: 0,
    ranked: d.ranked,
    cheapest: d.cheapest,
    priciest: d.priciest,
    saveCents: d.saveCents,
    realCount: d.realCount,
  };
}

export type PlannerProps = {
  /** "demo" = public teaser (unlimited, cheapest-store shown). "app" = signed-in product. */
  mode: "demo" | "app";
  isPro?: boolean;
  /** Free-tier rolling weekly plan limit; null = unlimited. */
  weeklyLimit?: number | null;
  weeklyUsed?: number;
  accountEmail?: string | null;
  /** Saved addresses (app/Pro), drives the real cheapest-store search. */
  addresses?: { id: string; label: string }[];
};

export default function Planner({
  mode,
  isPro = false,
  weeklyLimit = null,
  weeklyUsed = 0,
  accountEmail = null,
  addresses = [],
}: PlannerProps) {
  const [servings, setServings] = useState(2);
  const [nights, setNights] = useState(5);
  const [diet, setDiet] = useState<string>("none");
  const [dislikes, setDislikes] = useState("");
  const [budget, setBudget] = useState("");

  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [swappingId, setSwappingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anchorIndex, setAnchorIndex] = useState(0);
  const [openRecipe, setOpenRecipe] = useState<PlannedMeal | null>(null);

  const [location, setLocation] = useState<string>(DEFAULT_LOCATION_ID);
  const [addressId, setAddressId] = useState<string>(addresses[0]?.id ?? "");
  const [ranking, setRanking] = useState<NormalizedRanking | null>(null);

  // Free-tier usage (app mode only).
  const [used, setUsed] = useState(weeklyUsed);
  const [limited, setLimited] = useState(false);

  const showStores = mode === "demo" || isPro;
  const canSwap = mode === "demo" || isPro; // per-meal swap is a Pro feature; demo teases it
  const usingAddress = mode === "app" && isPro; // real, address-based cheapest store
  const metered = mode === "app" && weeklyLimit != null;
  const atLimit = metered && used >= (weeklyLimit as number);

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCATION_KEY);
    if (saved && LOCATION_OPTIONS.some((o) => o.id === saved)) {
      queueMicrotask(() => setLocation(saved));
    }
  }, []);

  useEffect(() => {
    if (!plan || !showStores) return;
    const aisleSubtotals = Object.fromEntries(plan.groceryAisles.map((a) => [a.aisle, a.subtotalCents]));
    let cancelled = false;

    if (usingAddress) {
      if (!addressId) return;
      const items = plan.groceryAisles.flatMap((a) =>
        a.items.map((i) => ({
          key: i.key,
          displayName: i.displayName,
          aisle: a.aisle,
          lineCents: i.lineCents,
          packsNeeded: i.packsNeeded,
        })),
      );
      fetch("/api/stores/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId, aisleSubtotals, items }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setRanking(data?.ranked ? normalizeNearby(data as NearbyResult) : null);
        })
        .catch(() => {
          if (!cancelled) setRanking(null);
        });
    } else {
      fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location, aisleSubtotals }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setRanking(data?.ranked ? normalizeMetro(data as StoreRanking) : null);
        })
        .catch(() => {
          if (!cancelled) setRanking(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [plan, location, addressId, showStores, usingAddress]);

  function changeLocation(id: string) {
    setLocation(id);
    if (typeof window !== "undefined") window.localStorage.setItem(LOCATION_KEY, id);
  }

  async function generate(nextAnchor = 0) {
    if (atLimit) {
      setLimited(true);
      return;
    }
    setLoading(true);
    setError(null);
    setAnchorIndex(nextAnchor);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ servings, nights, diet, dislikes, budget, anchorIndex: nextAnchor }),
      });
      const data = await res.json();
      if (res.status === 403 && data.limitReached) {
        setLimited(true);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (!data.meals?.length) throw new Error("No recipes matched — try loosening your filters.");
      setPlan(data as PlanResult);
      setSavedPlanId(typeof data.savedPlanId === "string" ? data.savedPlanId : null);
      if (metered) setUsed((u) => u + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Replace one dinner with the best alternative that keeps the grocery overlap.
  // Editing the week you already have isn't a new plan, so it isn't metered.
  async function swapMeal(mealId: number) {
    if (!plan || swappingId != null) return;
    setSwappingId(mealId);
    setError(null);
    try {
      const res = await fetch("/api/plan/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefs: plan.preferences,
          currentIds: plan.meals.map((m) => m.id),
          mealId,
          savedPlanId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't swap that meal.");
      setPlan(data as PlanResult);
      if (typeof data.savedPlanId === "string") setSavedPlanId(data.savedPlanId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSwappingId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-200/70 bg-[var(--background)]/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <ForkMark className="h-6 w-6" />
            <span className="font-display text-xl font-black tracking-tight text-brand-dark">Forkcast</span>
            <span className="ml-1 hidden text-sm text-stone-500 sm:inline">Plan once. Eat all week.</span>
          </Link>
          <div className="flex items-center gap-2">
            {plan && !atLimit && (
              <button
                onClick={() => generate(anchorIndex + 1)}
                disabled={loading}
                className="rounded-full border border-brand/30 bg-white px-4 py-1.5 text-sm font-medium text-brand-dark shadow-sm transition hover:bg-brand/5 disabled:opacity-50"
              >
                ↻ Regenerate
              </button>
            )}
            {mode === "app" && isPro && (
              <Link
                href="/history"
                className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:text-brand-dark sm:inline"
              >
                History
              </Link>
            )}
            {mode === "app" ? (
              <Link
                href="/account"
                className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:text-brand-dark"
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    isPro ? "bg-brand/10 text-brand-dark" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {isPro ? "Pro" : "Free"}
                </span>
                <span className="hidden sm:inline">{accountEmail ?? "Account"}</span>
              </Link>
            ) : (
              <Link
                href="/"
                className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:text-brand-dark sm:inline"
              >
                ← Home
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[340px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Set it once</h2>

            <div className="mt-4 space-y-5">
              {showStores && !usingAddress && (
                <Field label="Your location">
                  <div className="flex items-center rounded-lg border border-stone-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                    <span className="pl-3 text-stone-400" aria-hidden>📍</span>
                    <select
                      value={location}
                      onChange={(e) => changeLocation(e.target.value)}
                      className="w-full cursor-pointer rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
                    >
                      {LOCATION_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="mt-1 text-xs text-stone-400">We&apos;ll find the cheapest store within {SEARCH_RADIUS_MI} miles.</p>
                </Field>
              )}

              {usingAddress && (
                <Field label="Your address">
                  {addresses.length > 0 ? (
                    <>
                      <div className="flex items-center rounded-lg border border-stone-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                        <span className="pl-3 text-stone-400" aria-hidden>📍</span>
                        <select
                          value={addressId}
                          onChange={(e) => setAddressId(e.target.value)}
                          className="w-full cursor-pointer rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
                        >
                          {addresses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-1 text-xs text-stone-400">
                        Real prices within {SEARCH_RADIUS_MI} miles ·{" "}
                        <Link href="/account" className="text-brand-dark underline">Manage addresses</Link>
                      </p>
                    </>
                  ) : (
                    <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 p-3 text-center">
                      <p className="text-xs text-stone-600">Add your address to find the cheapest store near you.</p>
                      <Link href="/account" className="mt-1 inline-block text-sm font-semibold text-brand-dark">
                        Add an address →
                      </Link>
                    </div>
                  )}
                </Field>
              )}

              <Field label="Who's eating?">
                <Stepper value={servings} min={1} max={8} onChange={setServings} suffix={servings === 1 ? "person" : "people"} />
              </Field>

              <Field label="Dinners this week">
                <Segmented
                  options={[3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
                  value={String(nights)}
                  onChange={(v) => setNights(Number(v))}
                />
              </Field>

              <Field label="Diet">
                <Segmented options={DIET_OPTIONS.map((d) => ({ value: d.value, label: d.label }))} value={diet} onChange={setDiet} wrap />
              </Field>

              <Field label="Skip these (optional)">
                <input
                  value={dislikes}
                  onChange={(e) => setDislikes(e.target.value)}
                  placeholder="e.g. mushrooms, olives"
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </Field>

              <Field label="Weekly budget (optional)">
                <div className="flex items-center rounded-lg border border-stone-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                  <span className="pl-3 text-stone-400">$</span>
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="No limit"
                    className="w-full rounded-lg bg-transparent px-2 py-2 text-sm outline-none"
                  />
                </div>
              </Field>
            </div>

            <button
              onClick={() => generate(0)}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-brand py-3 text-center font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
            >
              {loading ? "Planning…" : plan ? "Make a new plan" : "Plan my week"}
            </button>

            {metered && !isPro && (
              <p className="mt-2 text-center text-xs text-stone-400">
                {Math.max(0, (weeklyLimit as number) - used)} of {weeklyLimit} free plans left this week
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

            {limited && (
              <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
                <p className="text-sm font-medium text-stone-800">You&apos;ve used your free plan this week.</p>
                <p className="mt-1 text-xs text-stone-500">Upgrade to Pro for unlimited plans, the cheapest store near you, and the weekly email.</p>
                <Link
                  href="/pricing"
                  className="mt-3 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
                >
                  Upgrade to Pro — $5/mo
                </Link>
              </div>
            )}
          </div>
        </aside>

        <section>
          {!plan && !loading && <Hero />}
          {loading && !plan && <div className="py-24 text-center text-stone-500">Choosing dinners that share ingredients…</div>}
          {plan && (
            <Results
              plan={plan}
              onOpenRecipe={setOpenRecipe}
              onSwap={swapMeal}
              swappingId={swappingId}
              canSwap={canSwap}
              ranking={ranking}
              showStores={showStores}
              lockedStores={mode === "app" && !isPro}
            />
          )}
        </section>
      </main>

      {openRecipe && <RecipeModal meal={openRecipe} onClose={() => setOpenRecipe(null)} />}

      <footer className="mx-auto max-w-6xl px-5 py-10 text-center text-xs text-stone-400">
        {mode === "app" ? "Your plans are saved to your account · " : "Prototype · "}
        recipes from TheMealDB, normalized into Forkcast&apos;s ingredient catalog · costs are estimates
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/50 p-10 text-center">
      <h1 className="mx-auto max-w-md font-display text-4xl font-black tracking-tight text-stone-800">
        Dinner, <span className="text-brand">decided.</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-stone-600">
        Set your preferences and Forkcast picks a week of dinners whose ingredients overlap — then hands you one aisle-sorted grocery
        list with the cost up front, and a 90-minute Sunday prep plan.
      </p>
      <p className="mt-6 text-sm font-medium text-brand-dark">← Start on the left.</p>
    </div>
  );
}

function Results({
  plan,
  onOpenRecipe,
  onSwap,
  swappingId,
  canSwap,
  ranking,
  showStores,
  lockedStores,
}: {
  plan: PlanResult;
  onOpenRecipe: (m: PlannedMeal) => void;
  onSwap: (mealId: number) => void;
  swappingId: number | null;
  canSwap: boolean;
  ranking: NormalizedRanking | null;
  showStores: boolean;
  lockedStores: boolean;
}) {
  return (
    <div className="space-y-8">
      <StatStrip plan={plan} />
      <PlanSection plan={plan} onOpenRecipe={onOpenRecipe} onSwap={onSwap} swappingId={swappingId} canSwap={canSwap} />
      <GrocerySection plan={plan} />
      {showStores ? <StoresSection ranking={ranking} /> : lockedStores ? <LockedStores /> : null}
      <PrepSection plan={plan} />
    </div>
  );
}

function LockedStores() {
  return (
    <div>
      <SectionTitle>Where to buy it cheapest</SectionTitle>
      <div className="rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-accent/5 p-6 text-center shadow-sm">
        <div className="text-2xl" aria-hidden>🔒</div>
        <p className="mt-2 font-display text-lg font-bold tracking-tight text-stone-800">
          See the cheapest store near you
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-stone-500">
          Pro prices this exact haul at every grocery store within {SEARCH_RADIUS_MI} miles of your address and points you to the cheapest one.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          Upgrade to Pro — $5/mo
        </Link>
      </div>
    </div>
  );
}

function StoresSection({ ranking }: { ranking: NormalizedRanking | null }) {
  if (!ranking || !ranking.cheapest) return null;

  const { cheapest, priciest, ranked } = ranking;

  return (
    <div>
      <SectionTitle hint={`${ranking.withinCount} stores within ${ranking.radiusMi} mi`}>
        Where to buy it cheapest
      </SectionTitle>

      <div className="overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/5 to-accent/5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 p-5">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-dark">
              Cheapest near {ranking.label}
              {cheapest.source && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                    cheapest.source === "real" ? "bg-brand/15 text-brand-dark" : "bg-stone-100 text-stone-500"
                  }`}
                >
                  {cheapest.source === "real" ? "real price" : "estimated"}
                </span>
              )}
            </div>
            <div className="mt-1 font-display text-2xl font-black tracking-tight text-stone-800">{cheapest.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500">
              <span>{cheapest.tag}</span>
              <span aria-hidden>·</span>
              <span>{cheapest.distanceMi} mi away</span>
              {cheapest.bestAisle && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-brand-dark">great on {cheapest.bestAisle.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-black tabular-nums text-brand-dark">{money(cheapest.totalCents)}</div>
            {ranking.saveCents > 0 && priciest && (
              <div className="mt-0.5 text-xs font-medium text-accent">
                save {money(ranking.saveCents)} vs {priciest.chain}
              </div>
            )}
          </div>
        </div>

        <ul className="border-t border-brand/15 bg-white/60">
          {ranked.map((s, i) => {
            const isBest = i === 0;
            const overBest = s.totalCents - cheapest.totalCents;
            return (
              <li
                key={s.id}
                className={`flex items-center justify-between gap-3 px-5 py-2.5 text-sm ${
                  i < ranked.length - 1 ? "border-b border-stone-100" : ""
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    isBest ? "bg-brand text-white" : "bg-stone-100 text-stone-500"
                  }`}>
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-stone-800">{s.chain}</span>
                  <span className="hidden truncate text-xs text-stone-400 sm:inline">{s.tag} · {s.distanceMi} mi</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 tabular-nums">
                  {!isBest && <span className="text-xs text-stone-400">+{money(overBest)}</span>}
                  <span className={`font-medium ${isBest ? "text-brand-dark" : "text-stone-600"}`}>{money(s.totalCents)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-2 text-xs text-stone-400">
        {ranking.realCount > 0
          ? `Real prices from ${ranking.realCount} store${ranking.realCount > 1 ? "s" : ""}; others are modeled estimates for this exact haul`
          : "Estimated from each store's typical pricing for this exact haul"}
        {ranking.excludedCount > 0 ? ` · ${ranking.excludedCount} more just outside ${ranking.radiusMi} mi` : ""}.
      </p>
    </div>
  );
}

function StatStrip({ plan }: { plan: PlanResult }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Weekly total" value={money(plan.totalCents)} big />
        <Stat label="Per serving" value={money(plan.perServingCents)} accent />
        <Stat label="You save*" value={money(plan.overlapSavingsCents)} />
        <Stat label="Servings made" value={String(plan.servingsProduced)} />
      </div>
      <p className="mt-2 text-xs text-stone-400">
        *vs. buying each recipe&apos;s ingredients separately — the overlap engine reuses {plan.meals.length > 0 ? "shared" : ""} ingredients across meals.
        {plan.budgetCents != null && (
          <span className={`ml-2 font-medium ${plan.overBudget ? "text-red-600" : "text-brand-dark"}`}>
            {plan.overBudget
              ? `Over your ${money(plan.budgetCents)} budget by ${money(plan.totalCents - plan.budgetCents)}.`
              : `${money(plan.budgetCents - plan.totalCents)} under your ${money(plan.budgetCents)} budget.`}
          </span>
        )}
      </p>
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

function PlanSection({
  plan,
  onOpenRecipe,
  onSwap,
  swappingId,
  canSwap,
}: {
  plan: PlanResult;
  onOpenRecipe: (m: PlannedMeal) => void;
  onSwap: (mealId: number) => void;
  swappingId: number | null;
  canSwap: boolean;
}) {
  const busy = swappingId != null;
  return (
    <div>
      <SectionTitle hint={`${plan.meals.length} dinners`}>This week&apos;s plan</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        {plan.meals.map((m) => {
          const swapping = swappingId === m.id;
          return (
            <div
              key={m.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition ${
                swapping ? "opacity-60" : ""
              }`}
            >
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
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => onOpenRecipe(m)}
                    className="rounded-full border border-brand/30 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand-dark transition hover:bg-brand/10"
                  >
                    View full recipe →
                  </button>
                  {canSwap && (
                    <button
                      onClick={() => onSwap(m.id)}
                      disabled={busy}
                      title="Swap this dinner for another that keeps your grocery overlap"
                      className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold text-stone-500 transition hover:border-brand/40 hover:text-brand-dark disabled:opacity-50"
                    >
                      {swapping ? "Swapping…" : "↻ Swap"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecipeModal({ meal, onClose }: { meal: PlannedMeal; onClose: () => void }) {
  const d = meal.detail;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-[var(--background)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {meal.imageUrl && <img src={meal.imageUrl} alt={meal.title} className="h-44 w-full object-cover" />}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight text-stone-800">{meal.title}</h2>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <Pill tone="brand">{meal.protein}</Pill>
                {meal.area && <Pill tone="stone">{meal.area}</Pill>}
                <Pill tone="stone">Serves {d.servings}</Pill>
                {d.totalTimeMinutes ? <Pill tone="stone">~{d.totalTimeMinutes} min</Pill> : null}
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="shrink-0 rounded-full border border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:bg-stone-100">
              ✕
            </button>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">You&apos;ll need</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.equipment.map((e) => (
                <span key={e} className="rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
                  {e}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-[200px_1fr]">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Ingredients</h3>
              <ul className="mt-2 space-y-1.5 text-sm">
                {d.ingredients.map((i, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="min-w-[72px] shrink-0 font-medium tabular-nums text-brand-dark">{i.measure}</span>
                    <span className="text-stone-700">{i.name}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Method</h3>
              <ol className="mt-2 space-y-4">
                {d.steps.map((s, idx) => (
                  <li key={idx} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{idx + 1}</span>
                    <div>
                      <p className="text-sm leading-relaxed text-stone-700">{s.text}</p>
                      {s.uses.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.uses.map((u, i) => (
                            <span key={i} className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] font-medium text-accent">
                              {u.name} · {u.measure}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrocerySection({ plan }: { plan: PlanResult }) {
  return (
    <div>
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
          <span className="font-medium text-stone-600">Pantry staples you likely have</span> (not counted): {plan.pantryStaples.join(", ")}.
        </p>
      )}
    </div>
  );
}

function PrepSection({ plan }: { plan: PlanResult }) {
  const totalMin = plan.prep.reduce((s, b) => s + b.minutes, 0);
  return (
    <div>
      <SectionTitle hint={`~${totalMin} min, once`}>Sunday prep</SectionTitle>
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

        <div className="mt-5 border-t border-stone-100 pt-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Then weeknights are easy</h4>
          <ul className="mt-2 space-y-1.5 text-sm">
            {plan.weeknightAssembly.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-medium text-stone-800">{w.title}:</span>
                <span className="text-stone-600">{w.note}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---- small UI atoms ---- */

function ForkMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Forkcast">
      <g fill="#15803D">
        <rect x="12" y="26" width="7" height="12" rx="3.5" />
        <rect x="23" y="20" width="7" height="18" rx="3.5" />
        <rect x="34" y="14" width="7" height="24" rx="3.5" />
        <rect x="45" y="8" width="7" height="30" rx="3.5" />
        <rect x="11" y="35" width="42" height="7" rx="3.5" />
        <rect x="28" y="40" width="8" height="18" rx="4" />
      </g>
      <circle cx="48.5" cy="8" r="3.4" fill="#EA580C" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "brand" | "stone" }) {
  const cls = tone === "brand" ? "bg-brand/10 text-brand-dark" : "bg-stone-100 text-stone-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function Segmented({
  options,
  value,
  onChange,
  wrap,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  wrap?: boolean;
}) {
  return (
    <div className={`flex gap-1.5 ${wrap ? "flex-wrap" : ""}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              active ? "border-brand bg-brand text-white shadow-sm" : "border-stone-300 bg-white text-stone-600 hover:border-brand/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, min, max, onChange, suffix }: { value: number; min: number; max: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center rounded-lg border border-stone-300">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="px-3 py-1.5 text-lg text-stone-500 hover:text-brand-dark">
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="px-3 py-1.5 text-lg text-stone-500 hover:text-brand-dark">
          +
        </button>
      </div>
      {suffix && <span className="text-sm text-stone-500">{suffix}</span>}
    </div>
  );
}
