// Where to buy the week cheapest.
//
// Forkcast knows the haul (the aisle-grouped grocery list with costs). Given the
// user's location, this compares the nearby grocery stores and finds the cheapest
// place to buy THIS basket — and because pricing is modeled per aisle, the winner
// genuinely depends on what's in the week: a meat-heavy plan wins at a warehouse
// club, a produce-heavy plan at a deals supermarket.
//
// Real per-store SKU pricing isn't publicly available, so (like the rest of the
// prototype's cost model) store pricing is modeled: each store has an overall
// price index and per-aisle multipliers calibrated to how that kind of store
// actually prices. It's a faithful demonstration of the concept, clearly labeled
// as an estimate in the UI.

export const SEARCH_RADIUS_MI = 15;

// Multipliers are relative to Forkcast's baseline catalog price (1.0). The
// effective price of an aisle at a store = priceIndex × (aisle override ?? 1).
export type Archetype = {
  tag: string;
  priceIndex: number;
  aisles: Record<string, number>;
};

export const ARCHETYPES = {
  warehouse: {
    tag: "Warehouse club",
    priceIndex: 0.8,
    aisles: { "Meat & Seafood": 0.84, "Dairy & Eggs": 0.86, Produce: 1.06, Pantry: 0.9 },
  },
  budget: {
    tag: "Budget grocer",
    priceIndex: 0.84,
    aisles: { Pantry: 0.9, "Dairy & Eggs": 0.92, Produce: 1.03, Frozen: 0.88 },
  },
  supercenter: {
    tag: "Supercenter",
    priceIndex: 0.88,
    aisles: { "Meat & Seafood": 0.95, Pantry: 0.95, Bakery: 0.97 },
  },
  mainstream: {
    tag: "Supermarket",
    priceIndex: 1.0,
    aisles: { Produce: 0.95, Bakery: 0.98 },
  },
  specialty: {
    tag: "Specialty market",
    priceIndex: 0.96,
    aisles: { "Dairy & Eggs": 0.82, Pantry: 0.86, Produce: 1.06, "Meat & Seafood": 1.05 },
  },
  premium: {
    tag: "Premium market",
    priceIndex: 1.2,
    aisles: { "Meat & Seafood": 1.3, Produce: 1.16, "Dairy & Eggs": 1.1, Bakery: 1.12 },
  },
} satisfies Record<string, Archetype>;

export type ArchetypeKey = keyof typeof ARCHETYPES;

export type StoreSeed = {
  name: string;
  chain: string;
  archetype: ArchetypeKey;
  lat: number;
  lng: number;
};

export type LocationOption = { id: string; label: string };

type LocationSeed = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  stores: StoreSeed[];
};

// A handful of demo metros, each with real nearby chains. Coordinates are real-ish
// so the 15-mile radius filter is genuine haversine math; one store per metro sits
// just outside the radius to show the proximity cutoff working.
const LOCATIONS: LocationSeed[] = [
  {
    id: "austin",
    label: "Austin, TX",
    lat: 30.2672,
    lng: -97.7431,
    stores: [
      { name: "H-E-B — South Congress", chain: "H-E-B", archetype: "mainstream", lat: 30.245, lng: -97.751 },
      { name: "ALDI — Ben White", chain: "ALDI", archetype: "budget", lat: 30.222, lng: -97.79 },
      { name: "Walmart Supercenter — Ben White", chain: "Walmart", archetype: "supercenter", lat: 30.226, lng: -97.793 },
      { name: "Costco — Southpark Meadows", chain: "Costco", archetype: "warehouse", lat: 30.144, lng: -97.79 },
      { name: "Trader Joe's — Rock Rose", chain: "Trader Joe's", archetype: "specialty", lat: 30.401, lng: -97.726 },
      { name: "Whole Foods — Domain", chain: "Whole Foods", archetype: "premium", lat: 30.401, lng: -97.72 },
      { name: "H-E-B — Cedar Park", chain: "H-E-B", archetype: "mainstream", lat: 30.51, lng: -97.82 },
    ],
  },
  {
    id: "brooklyn",
    label: "Brooklyn, NY",
    lat: 40.6782,
    lng: -73.9442,
    stores: [
      { name: "Key Food — Prospect Heights", chain: "Key Food", archetype: "mainstream", lat: 40.677, lng: -73.968 },
      { name: "ALDI — Bushwick", chain: "ALDI", archetype: "budget", lat: 40.694, lng: -73.905 },
      { name: "Trader Joe's — Court St", chain: "Trader Joe's", archetype: "specialty", lat: 40.688, lng: -73.994 },
      { name: "Whole Foods — Gowanus", chain: "Whole Foods", archetype: "premium", lat: 40.674, lng: -73.989 },
      { name: "ShopRite — Gateway", chain: "ShopRite", archetype: "supercenter", lat: 40.652, lng: -73.873 },
      { name: "Costco — Sunset Park", chain: "Costco", archetype: "warehouse", lat: 40.658, lng: -74.012 },
      { name: "Stew Leonard's — Paramus", chain: "Stew Leonard's", archetype: "mainstream", lat: 40.92, lng: -74.07 },
    ],
  },
  {
    id: "sf",
    label: "San Francisco, CA",
    lat: 37.7749,
    lng: -122.4194,
    stores: [
      { name: "Safeway — Market St", chain: "Safeway", archetype: "mainstream", lat: 37.77, lng: -122.429 },
      { name: "Grocery Outlet — SoMa", chain: "Grocery Outlet", archetype: "budget", lat: 37.776, lng: -122.408 },
      { name: "Trader Joe's — Masonic", chain: "Trader Joe's", archetype: "specialty", lat: 37.782, lng: -122.446 },
      { name: "Whole Foods — SoMa", chain: "Whole Foods", archetype: "premium", lat: 37.772, lng: -122.41 },
      { name: "Costco — South SF", chain: "Costco", archetype: "warehouse", lat: 37.668, lng: -122.41 },
      { name: "Smart & Final — Mission", chain: "Smart & Final", archetype: "supercenter", lat: 37.748, lng: -122.418 },
      { name: "Berkeley Bowl — Berkeley", chain: "Berkeley Bowl", archetype: "mainstream", lat: 37.857, lng: -122.273 },
    ],
  },
];

export const LOCATION_OPTIONS: LocationOption[] = LOCATIONS.map((l) => ({ id: l.id, label: l.label }));
export const DEFAULT_LOCATION_ID = LOCATIONS[0].id;

export type RankedStore = {
  id: string;
  name: string;
  chain: string;
  tag: string;
  distanceMi: number;
  totalCents: number;
  bestAisle: string | null; // the aisle this store prices most favorably (with spend)
};

export type StoreRanking = {
  locationId: string;
  locationLabel: string;
  radiusMi: number;
  baselineCents: number; // Forkcast's catalog estimate for the haul
  withinCount: number;
  excludedCount: number; // nearby stores beyond the radius
  ranked: RankedStore[];
  cheapest: RankedStore | null;
  priciest: RankedStore | null;
  saveCents: number; // priciest − cheapest among nearby
  saveVsBaselineCents: number; // baseline − cheapest
};

export function haversineMi(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function effMult(arch: Archetype, aisle: string): number {
  return arch.priceIndex * (arch.aisles[aisle] ?? 1);
}

// Flat list of every seeded store (across demo metros), used as the dev fallback
// for "nearby stores" when no real Places API key is configured.
export type SeededStore = StoreSeed & { metroId: string };
export const SEEDED_STORES: SeededStore[] = LOCATIONS.flatMap((l) =>
  l.stores.map((s) => ({ ...s, metroId: l.id })),
);

/** Modeled cost of a basket (aisle subtotals, cents) at a store archetype. */
export function modeledTotalCents(
  archetype: ArchetypeKey,
  aisleSubtotals: Record<string, number>,
): number {
  const arch = ARCHETYPES[archetype];
  let total = 0;
  for (const [aisle, cents] of Object.entries(aisleSubtotals)) total += cents * effMult(arch, aisle);
  return Math.round(total);
}

/** The aisle a store archetype prices most favorably, among aisles with spend. */
export function bestAisleFor(
  archetype: ArchetypeKey,
  aisleSubtotals: Record<string, number>,
): string | null {
  const arch = ARCHETYPES[archetype];
  let best: string | null = null;
  let bestMult = Infinity;
  for (const aisle of Object.keys(aisleSubtotals)) {
    if (aisleSubtotals[aisle] <= 0) continue;
    const m = effMult(arch, aisle);
    if (m < bestMult) {
      bestMult = m;
      best = aisle;
    }
  }
  return bestMult < 1 ? best : null;
}

/**
 * Rank nearby stores by what this specific basket would cost at each.
 * @param aisleSubtotals catalog cost per aisle, e.g. { "Meat & Seafood": 1946, ... } in cents
 */
export function rankStores(
  locationId: string,
  aisleSubtotals: Record<string, number>,
  radiusMi: number = SEARCH_RADIUS_MI,
): StoreRanking | null {
  const loc = LOCATIONS.find((l) => l.id === locationId);
  if (!loc) return null;

  const baselineCents = Object.values(aisleSubtotals).reduce((s, c) => s + c, 0);
  const aislesWithSpend = Object.keys(aisleSubtotals).filter((a) => aisleSubtotals[a] > 0);

  let excludedCount = 0;
  const ranked: RankedStore[] = [];

  for (const [i, store] of loc.stores.entries()) {
    const distanceMi = haversineMi(loc.lat, loc.lng, store.lat, store.lng);
    if (distanceMi > radiusMi) {
      excludedCount++;
      continue;
    }
    const arch = ARCHETYPES[store.archetype];
    let totalCents = 0;
    for (const aisle of aislesWithSpend) {
      totalCents += aisleSubtotals[aisle] * effMult(arch, aisle);
    }
    // The aisle this store prices most favorably, among aisles the haul spends on.
    let bestAisle: string | null = null;
    let bestMult = Infinity;
    for (const aisle of aislesWithSpend) {
      const m = effMult(arch, aisle);
      if (m < bestMult) {
        bestMult = m;
        bestAisle = aisle;
      }
    }
    ranked.push({
      id: `${store.chain}-${i}`,
      name: store.name,
      chain: store.chain,
      tag: arch.tag,
      distanceMi: Math.round(distanceMi * 10) / 10,
      totalCents: Math.round(totalCents),
      bestAisle: bestMult < 1 ? bestAisle : null,
    });
  }

  ranked.sort((a, b) => a.totalCents - b.totalCents || a.distanceMi - b.distanceMi);

  const cheapest = ranked[0] ?? null;
  const priciest = ranked.length ? ranked[ranked.length - 1] : null;

  return {
    locationId: loc.id,
    locationLabel: loc.label,
    radiusMi,
    baselineCents,
    withinCount: ranked.length,
    excludedCount,
    ranked,
    cheapest,
    priciest,
    saveCents: cheapest && priciest ? priciest.totalCents - cheapest.totalCents : 0,
    saveVsBaselineCents: cheapest ? Math.max(0, baselineCents - cheapest.totalCents) : 0,
  };
}
