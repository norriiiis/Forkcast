// The address → cheapest-store pipeline.
//
//   point → nearby grocery stores (15 mi) → price THIS basket at each
//   (real Kroger prices where available, modeled estimate elsewhere) → rank.
//
// Real prices are cached in StorePrice (per store + ingredient, TTL) so repeat
// runs are cheap. Every store/total is labeled real vs estimated.
import { prisma } from "@/lib/db";
import { nearbyGroceryStores, type GeoPoint, type NearbyStore } from "@/lib/geo";
import {
  ARCHETYPES,
  bestAisleFor,
  modeledTotalCents,
  SEARCH_RADIUS_MI,
  type ArchetypeKey,
} from "@/lib/store-pricing";
import {
  KROGER_ENABLED,
  isKrogerChain,
  findKrogerLocationId,
  krogerItemPriceCents,
  TERM_OVERRIDES,
} from "@/lib/pricing/kroger";

export type BasketItem = {
  key: string;
  displayName: string;
  aisle: string;
  lineCents: number;
  packsNeeded: number;
};
export type Basket = {
  aisleSubtotals: Record<string, number>;
  items: BasketItem[];
};

export type PricedStore = {
  id: string;
  name: string;
  chain: string;
  tag: string;
  distanceMi: number;
  totalCents: number;
  source: "real" | "estimated";
  bestAisle: string | null;
};

export type CheapestResult = {
  radiusMi: number;
  baselineCents: number;
  withinCount: number;
  ranked: PricedStore[];
  cheapest: PricedStore | null;
  priciest: PricedStore | null;
  saveCents: number;
  saveVsBaselineCents: number;
  realCount: number;
};

const PRICE_TTL_MS = 24 * 60 * 60 * 1000;

// Map a chain name → a pricing archetype (used for modeled pricing of real Places
// results that don't carry one).
function inferArchetype(chain: string): ArchetypeKey {
  const c = chain.toLowerCase();
  if (c.includes("costco") || c.includes("sam") || c.includes("bj")) return "warehouse";
  if (c.includes("aldi") || c.includes("grocery outlet") || c.includes("lidl") || c.includes("food4less")) return "budget";
  if (c.includes("walmart") || c.includes("target") || c.includes("shoprite") || c.includes("smart") || c.includes("winco")) return "supercenter";
  if (c.includes("whole foods") || c.includes("bristol") || c.includes("erewhon")) return "premium";
  if (c.includes("trader joe") || c.includes("sprouts")) return "specialty";
  return "mainstream";
}

// Real basket total at a Kroger-family store, with per-ingredient caching. Returns
// null if no Kroger location resolves; falls back to baseline per item otherwise.
async function priceBasketReal(
  point: GeoPoint,
  store: NearbyStore,
  basket: Basket,
): Promise<number | null> {
  const locationId = await findKrogerLocationId(point);
  if (!locationId) return null;

  // Persist a StoreLocation row so prices can be cached against it.
  const storeRow = await prisma.storeLocation
    .upsert({
      where: { provider_externalId: { provider: store.provider, externalId: store.externalId } },
      create: {
        provider: store.provider,
        externalId: store.externalId,
        chain: store.chain,
        name: store.name,
        lat: store.lat,
        lng: store.lng,
        krogerLocationId: locationId,
      },
      update: { krogerLocationId: locationId },
    })
    .catch(() => null);

  let total = 0;
  const cutoff = new Date(Date.now() - PRICE_TTL_MS);
  for (const item of basket.items) {
    let unitCents: number | null = null;

    if (storeRow) {
      const cached = await prisma.storePrice
        .findUnique({ where: { storeLocationId_ingredientKey: { storeLocationId: storeRow.id, ingredientKey: item.key } } })
        .catch(() => null);
      if (cached && cached.source === "real" && cached.fetchedAt > cutoff) unitCents = cached.priceCents;
    }

    if (unitCents == null) {
      const term = TERM_OVERRIDES[item.key] ?? item.displayName;
      unitCents = await krogerItemPriceCents(locationId, term);
      if (unitCents != null && storeRow) {
        await prisma.storePrice
          .upsert({
            where: { storeLocationId_ingredientKey: { storeLocationId: storeRow.id, ingredientKey: item.key } },
            create: { storeLocationId: storeRow.id, ingredientKey: item.key, priceCents: unitCents, source: "real" },
            update: { priceCents: unitCents, source: "real", fetchedAt: new Date() },
          })
          .catch(() => {});
      }
    }

    // Real unit price × packs, or fall back to the catalog line for this item.
    total += unitCents != null ? unitCents * Math.max(1, item.packsNeeded) : item.lineCents;
  }
  return Math.round(total);
}

export async function cheapestForPoint(
  point: GeoPoint,
  basket: Basket,
  radiusMi: number = SEARCH_RADIUS_MI,
): Promise<CheapestResult> {
  const nearby = await nearbyGroceryStores(point, radiusMi);
  const baselineCents = Object.values(basket.aisleSubtotals).reduce((s, c) => s + c, 0);

  const ranked: PricedStore[] = [];
  for (const store of nearby) {
    const archetype = store.archetype ?? inferArchetype(store.chain);
    let totalCents = modeledTotalCents(archetype, basket.aisleSubtotals);
    let source: "real" | "estimated" = "estimated";

    if (KROGER_ENABLED && isKrogerChain(store.chain)) {
      const real = await priceBasketReal(point, store, basket);
      if (real != null) {
        totalCents = real;
        source = "real";
      }
    }

    ranked.push({
      id: store.externalId,
      name: store.name,
      chain: store.chain,
      tag: ARCHETYPES[archetype].tag,
      distanceMi: store.distanceMi,
      totalCents,
      source,
      bestAisle: source === "estimated" ? bestAisleFor(archetype, basket.aisleSubtotals) : null,
    });
  }

  ranked.sort((a, b) => a.totalCents - b.totalCents || a.distanceMi - b.distanceMi);
  const cheapest = ranked[0] ?? null;
  const priciest = ranked.length ? ranked[ranked.length - 1] : null;

  return {
    radiusMi,
    baselineCents,
    withinCount: ranked.length,
    ranked,
    cheapest,
    priciest,
    saveCents: cheapest && priciest ? priciest.totalCents - cheapest.totalCents : 0,
    saveVsBaselineCents: cheapest ? Math.max(0, baselineCents - cheapest.totalCents) : 0,
    realCount: ranked.filter((s) => s.source === "real").length,
  };
}
