// Browser entry for the single-file build. Bundled by esbuild into one IIFE that
// exposes the real (tested) overlap engine + store-pricing on window.FC, so the
// inline app script in forkcast.html can run plans entirely client-side.
import { buildPlan } from "@/lib/engine";
import { rankStores, LOCATION_OPTIONS, SEARCH_RADIUS_MI } from "@/lib/store-pricing";

(window as unknown as { FC: unknown }).FC = {
  buildPlan,
  rankStores,
  LOCATION_OPTIONS,
  SEARCH_RADIUS_MI,
};
