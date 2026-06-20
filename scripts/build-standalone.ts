// Builds forkcast.html — the entire app (landing + live planner + cheapest-store)
// in one self-contained file. The overlap engine and store-pricing are the real
// modules, bundled for the browser with Prisma stubbed out; the ~371-recipe pool
// is embedded as JSON so plans generate fully client-side.
//
//   npm run standalone   →   ./forkcast.html
import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import * as esbuild from "esbuild";
import { loadPool } from "@/lib/engine";

const ROOT = process.cwd();
const SA = path.resolve(ROOT, "scripts/standalone");

// ---- repeated markup snippets (kept out of the template for readability) ----
const MARK =
  '<svg viewBox="0 0 64 64" class="h-full w-full text-basil" role="img" aria-label="Forkcast"><g fill="currentColor"><rect class="tine" x="12" y="26" width="7" height="12" rx="3.5"/><rect class="tine" x="23" y="20" width="7" height="18" rx="3.5"/><rect class="tine" x="34" y="14" width="7" height="24" rx="3.5"/><rect class="tine" x="45" y="8" width="7" height="30" rx="3.5"/><rect x="11" y="35" width="42" height="7" rx="3.5"/><rect x="28" y="40" width="8" height="18" rx="4"/></g><circle cx="48.5" cy="8" r="3.4" class="fill-ember"/></svg>';
const MARK_ANIMATE = MARK.replace("text-basil", "text-basil animate-mark");
const CHECK =
  '<svg viewBox="0 0 16 16" class="inline h-3 w-3" fill="none" aria-hidden="true"><path d="M3 8.5l3 3 7-7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_OVERLAP =
  '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>';
const ICON_LIST =
  '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M8 7h10M8 12h10M8 17h7"/><path d="M4 7h.01M4 12h.01M4 17h.01"/></svg>';
const ICON_TIMER =
  '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6"/></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.2-6.5-10A6.5 6.5 0 0 1 18.5 11c0 4.8-6.5 10-6.5 10Z"/><circle cx="12" cy="11" r="2.4"/></svg>';

const tag = (t: string) =>
  `<span class="rounded-full bg-basil/10 px-2 py-0.5 text-[0.7rem] font-medium text-forest">${t}</span>`;
const tagm = (t: string) =>
  `<span class="rounded-full bg-sage px-2 py-0.5 text-[0.7rem] font-medium text-muted">${t}</span>`;
const inb = (n: number) =>
  `<span class="shrink-0 rounded-full bg-basil/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-basil tnum">in ${n}</span>`;

const mealNode = (y: number, title: string) =>
  `<g><rect x="524" y="${y - 28}" width="216" height="56" rx="14" fill="#ffffff" stroke="var(--sage-line)"/><text x="544" y="${y + 5}" fill="var(--forest)" style="font-family:Inter,sans-serif;font-weight:600;font-size:14.5px">${title}</text></g>`;
const line = (d: string, cls: string) =>
  `<path d="${d}" class="flow-line ${cls}" style="--len:330" fill="none" stroke="var(--basil-bright)" stroke-opacity="0.6" stroke-width="2.5" stroke-linecap="round"/>`;
const pulse = (d: string, cls: string) =>
  `<path d="${d}" class="flow-pulse ${cls}" fill="none" stroke="var(--ember)" stroke-width="4" stroke-linecap="round"/>`;
const P1 = "M236 150 C 384 150 376 70 524 70";
const P2 = "M236 150 C 384 150 384 150 524 150";
const P3 = "M236 150 C 384 150 376 230 524 230";
const OVERLAP_DIAGRAM =
  `<svg viewBox="0 0 760 300" class="h-auto w-full" role="img" aria-label="One pack of chicken thighs flows into three dinners">` +
  line(P1, "") + line(P2, "l2") + line(P3, "l3") +
  pulse(P1, "") + pulse(P2, "p2") + pulse(P3, "p3") +
  `<circle cx="524" cy="70" r="4" fill="var(--basil-bright)"/><circle cx="524" cy="150" r="4" fill="var(--basil-bright)"/><circle cx="524" cy="230" r="4" fill="var(--basil-bright)"/>` +
  `<g><circle cx="128" cy="150" r="70" fill="var(--basil-bright)" opacity="0.16" class="bob" style="--r:0deg"/><rect x="20" y="112" width="216" height="76" rx="20" fill="var(--basil-bright)"/><circle cx="128" cy="150" r="78" fill="none" stroke="var(--basil-bright)" stroke-opacity="0.4"/><text x="128" y="144" text-anchor="middle" fill="var(--oat)" style="font-family:Fraunces,serif;font-weight:800;font-size:22px">1 pack</text><text x="128" y="168" text-anchor="middle" fill="#dff0e4" style="font-family:Inter,sans-serif;font-weight:500;font-size:14px">chicken thighs</text></g>` +
  mealNode(70, "Honey-Garlic Chicken") + mealNode(150, "Chicken Fajita Bowls") + mealNode(230, "Tuscan Chicken Pasta") +
  `</svg>`;

const SNIPPETS: Record<string, string> = {
  "__MARK_ANIMATE__": MARK_ANIMATE,
  "__MARK__": MARK,
  "__CHECK__": CHECK,
  "__ICON_OVERLAP__": ICON_OVERLAP,
  "__ICON_LIST__": ICON_LIST,
  "__ICON_TIMER__": ICON_TIMER,
  "__ICON_PIN__": ICON_PIN,
  "__OVERLAP_DIAGRAM__": OVERLAP_DIAGRAM,
  "__TAG_CHICKEN__": tag("Chicken"),
  "__TAG_PORK__": tag("Pork"),
  "__TAG_VEG__": tag("Vegetarian"),
  "__TAGM_AMERICAN__": tagm("American"),
  "__TAGM_MEXICAN__": tagm("Mexican"),
  "__TAGM_ITALIAN__": tagm("Italian"),
  "__TAGM_INDIAN__": tagm("Indian"),
  "__INBADGE2__": inb(2),
  "__INBADGE3__": inb(3),
  "__INBADGE5__": inb(5),
};

async function main() {
  // 1. Bundle the engine + store logic for the browser (Prisma aliased to a stub).
  const bundle = await esbuild.build({
    entryPoints: [path.resolve(SA, "entry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2019"],
    tsconfig: path.resolve(ROOT, "tsconfig.json"),
    alias: { "@/lib/db": path.resolve(SA, "db-stub.ts") },
    minify: true,
    write: false,
    legalComments: "none",
  });
  const logicJs = bundle.outputFiles[0].text;
  if (/PrismaClient/.test(logicJs)) {
    throw new Error("Prisma leaked into the browser bundle — check the db-stub alias.");
  }

  // 2. Load the real recipe pool and embed it (guard the script-close edge case).
  const pool = await loadPool();
  const poolJson = JSON.stringify(pool).replace(/<\/script/gi, "<\\/script");

  // 3. Read the app logic and the template, expand snippets, stitch everything.
  const appJs = await fs.readFile(path.resolve(SA, "app.js"), "utf8");
  let html = await fs.readFile(path.resolve(SA, "index.html"), "utf8");
  for (const [k, v] of Object.entries(SNIPPETS)) html = html.split(k).join(v);
  html = html
    .split("/*__APP__*/").join(appJs)
    .split("/*__LOGIC__*/").join(logicJs)
    .split("/*__POOL__*/").join(poolJson);

  const out = path.resolve(ROOT, "forkcast.html");
  await fs.writeFile(out, html);

  const kb = (s: string) => (Buffer.byteLength(s) / 1024).toFixed(0);
  console.log(
    `✓ forkcast.html written (${kb(html)} KB · logic ${kb(logicJs)} KB · app ${kb(appJs)} KB · ${pool.length} recipes ${kb(poolJson)} KB)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
