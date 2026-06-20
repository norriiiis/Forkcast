// Real per-store grocery prices via the Kroger Developer API (the Kroger family:
// Kroger, Ralphs, Fred Meyer, King Soopers, Smith's, Harris Teeter, Fry's, QFC…).
// Active only when KROGER_CLIENT_ID/SECRET are set; otherwise the pipeline uses
// the modeled estimate. Docs: https://developer.kroger.com
import type { GeoPoint } from "@/lib/geo";

export const KROGER_ENABLED = Boolean(
  process.env.KROGER_CLIENT_ID && process.env.KROGER_CLIENT_SECRET,
);

const KROGER_KEYS = [
  "kroger", "ralphs", "fredmeyer", "kingsoopers", "smiths", "harristeeter",
  "frys", "qfc", "dillons", "food4less", "foodsco", "marianos", "picknsave",
  "metromarket", "bakers", "garyfoods", "payless", "owens", "jaycfoods", "fredmeyerstores",
];

/** Is this (normalized) chain part of the Kroger family we can price for real? */
export function isKrogerChain(chain: string): boolean {
  const c = chain.replace(/[^a-z]/g, "");
  return KROGER_KEYS.some((k) => c.includes(k));
}

let tokenCache: { token: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!KROGER_ENABLED) return null;
  if (tokenCache && tokenCache.exp > Date.now() + 10_000) return tokenCache.token;
  const basic = Buffer.from(
    `${process.env.KROGER_CLIENT_ID}:${process.env.KROGER_CLIENT_SECRET}`,
  ).toString("base64");
  try {
    const res = await fetch("https://api.kroger.com/v1/connect/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=product.compact",
    });
    if (!res.ok) return null;
    const data = await res.json();
    tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 1800) * 1000 };
    return tokenCache.token;
  } catch (e) {
    console.error("Kroger token failed:", e);
    return null;
  }
}

/** The nearest Kroger-family store locationId to a point, or null. */
export async function findKrogerLocationId(point: GeoPoint): Promise<string | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.kroger.com/v1/locations?filter.lat.near=${point.lat}&filter.lon.near=${point.lng}&filter.limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.locationId ?? null;
  } catch (e) {
    console.error("Kroger locations failed:", e);
    return null;
  }
}

/** Real price (cents) of the best-matching product for a search term, or null. */
export async function krogerItemPriceCents(locationId: string, term: string): Promise<number | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.kroger.com/v1/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${locationId}&filter.limit=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const price = data?.data?.[0]?.items?.[0]?.price;
    const value = price?.promo || price?.regular;
    return typeof value === "number" && value > 0 ? Math.round(value * 100) : null;
  } catch (e) {
    console.error("Kroger products failed:", e);
    return null;
  }
}

// A few canonical-ingredient → search-term overrides where the catalog key differs
// from what searches well at the retailer. Defaults to the ingredient display name.
export const TERM_OVERRIDES: Record<string, string> = {
  "chicken thighs": "chicken thighs",
  "italian sausage": "italian sausage",
  "yellow onion": "yellow onion",
  "bell peppers": "bell pepper",
  "cherry tomatoes": "cherry tomatoes",
  "baby spinach": "baby spinach",
  "jasmine rice": "jasmine rice",
  "coconut milk": "coconut milk",
};
