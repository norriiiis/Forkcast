// Geocoding + nearby-store lookup, behind a provider abstraction.
//
// Real: Google Maps Platform (Geocoding API + Places Nearby Search) when
// GOOGLE_MAPS_API_KEY is set. Dev fallback: an offline ZIP→point table for
// geocoding and the seeded store list for nearby stores — so the whole
// address → cheapest-store pipeline is exercisable locally without keys.
import { SEEDED_STORES, haversineMi, type ArchetypeKey } from "@/lib/store-pricing";

export const GEO_ENABLED = Boolean(process.env.GOOGLE_MAPS_API_KEY);

export type GeoPoint = { lat: number; lng: number };

export type AddressInput = {
  line1?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

export type NearbyStore = {
  provider: string; // "google" | "seed"
  externalId: string;
  chain: string;
  name: string;
  lat: number;
  lng: number;
  distanceMi: number;
  archetype?: ArchetypeKey; // present for seeded stores (drives modeled pricing)
};

// Offline geocoder: ZIP prefix → approximate point. Covers the seeded metros plus
// a few large markets; unknown ZIPs fall back to the nearest covered metro center.
const ZIP_POINTS: { prefix: string; point: GeoPoint; label: string }[] = [
  { prefix: "787", point: { lat: 30.2672, lng: -97.7431 }, label: "Austin, TX" },
  { prefix: "112", point: { lat: 40.6782, lng: -73.9442 }, label: "Brooklyn, NY" },
  { prefix: "100", point: { lat: 40.7128, lng: -74.006 }, label: "New York, NY" },
  { prefix: "941", point: { lat: 37.7749, lng: -122.4194 }, label: "San Francisco, CA" },
  { prefix: "940", point: { lat: 37.7749, lng: -122.4194 }, label: "San Francisco, CA" },
];

function devGeocode(addr: AddressInput): GeoPoint | null {
  const zip = (addr.postalCode ?? "").replace(/[^0-9]/g, "");
  if (zip.length >= 3) {
    const hit = ZIP_POINTS.find((z) => zip.startsWith(z.prefix));
    if (hit) return hit.point;
  }
  // City-name fallback so a typed city still resolves in dev.
  const city = (addr.city ?? "").toLowerCase();
  if (city.includes("austin")) return ZIP_POINTS[0].point;
  if (city.includes("brooklyn")) return ZIP_POINTS[1].point;
  if (city.includes("new york") || city.includes("nyc")) return ZIP_POINTS[2].point;
  if (city.includes("francisco") || city.includes("oakland") || city.includes("berkeley"))
    return ZIP_POINTS[3].point;
  // Last resort in dev: the first seeded metro, so the flow always works.
  return zip || city ? ZIP_POINTS[0].point : null;
}

export async function geocodeAddress(addr: AddressInput): Promise<GeoPoint | null> {
  if (GEO_ENABLED) {
    const parts = [addr.line1, addr.city, addr.region, addr.postalCode, addr.country].filter(Boolean);
    const q = encodeURIComponent(parts.join(", "));
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
      );
      const data = await res.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (loc) return { lat: loc.lat, lng: loc.lng };
    } catch (e) {
      console.error("Google geocode failed, falling back:", e);
    }
  }
  return devGeocode(addr);
}

const GROCERY_TYPES = "supermarket";

export async function nearbyGroceryStores(
  point: GeoPoint,
  radiusMi: number,
): Promise<NearbyStore[]> {
  if (GEO_ENABLED) {
    try {
      const radiusM = Math.round(radiusMi * 1609.34);
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${point.lat},${point.lng}&radius=${radiusM}&type=${GROCERY_TYPES}&key=${process.env.GOOGLE_MAPS_API_KEY}`,
      );
      const data = await res.json();
      const results: NearbyStore[] = (data?.results ?? []).map(
        (r: {
          place_id: string;
          name: string;
          geometry: { location: { lat: number; lng: number } };
          vicinity?: string;
        }) => ({
          provider: "google",
          externalId: r.place_id,
          chain: normalizeChain(r.name),
          name: r.name,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          distanceMi: Math.round(haversineMi(point.lat, point.lng, r.geometry.location.lat, r.geometry.location.lng) * 10) / 10,
        }),
      );
      if (results.length) return results.filter((s) => s.distanceMi <= radiusMi);
    } catch (e) {
      console.error("Google Places failed, falling back to seeded stores:", e);
    }
  }

  // Dev fallback: seeded stores within the radius of the point.
  return SEEDED_STORES.map((s) => ({
    provider: "seed",
    externalId: `${s.metroId}:${s.chain}:${s.lat},${s.lng}`,
    chain: s.chain,
    name: s.name,
    lat: s.lat,
    lng: s.lng,
    archetype: s.archetype,
    distanceMi: Math.round(haversineMi(point.lat, point.lng, s.lat, s.lng) * 10) / 10,
  }))
    .filter((s) => s.distanceMi <= radiusMi)
    .sort((a, b) => a.distanceMi - b.distanceMi);
}

// Best-effort normalization of a store name → a chain key (for pricing-provider
// selection). Extend as needed.
export function normalizeChain(name: string): string {
  const n = name.toLowerCase();
  const known = [
    "kroger", "ralphs", "fred meyer", "king soopers", "smith's", "harris teeter", "fry's", "qfc",
    "walmart", "costco", "aldi", "trader joe", "whole foods", "safeway", "h-e-b", "heb",
    "shoprite", "publix", "target", "sprouts", "wegmans", "grocery outlet", "smart & final",
  ];
  const hit = known.find((k) => n.includes(k));
  return hit ? hit.replace(/[^a-z]/g, "") : n.split(/[—\-,]/)[0].trim();
}
