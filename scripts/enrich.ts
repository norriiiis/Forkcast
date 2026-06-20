// LLM recipe enrichment — turns the messy public recipe data into clean, original,
// step-by-step Forkcast recipes with normalized quantities, a tools list, and per-step
// ingredient usage. Uses Claude (claude-opus-4-8) with structured outputs so every
// result comes back in a guaranteed shape, then stores it on Recipe.enriched.
//
// Requires ANTHROPIC_API_KEY (add it to .env). Run:
//   npm run enrich -- --limit 5      # cheap test on 5 recipes first
//   npm run enrich                   # enrich everything not yet done
//   npm run enrich -- --force        # re-enrich everything

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { prisma } from "../src/lib/db";

const Line = z.object({
  name: z.string().describe("Ingredient name, e.g. 'Chicken breast'"),
  measure: z.string().describe("Quantity + prep, e.g. '1 lb, cut into strips'"),
});
const Step = z.object({
  text: z.string().describe("One concise instruction step, in your own words"),
  uses: z.array(Line).describe("Ingredients first added in THIS step, with the amount used here"),
});
const Enriched = z.object({
  servings: z.number().int(),
  totalTimeMinutes: z.number().int().describe("Realistic total active + cook time in minutes"),
  equipment: z.array(z.string()).describe("Specific tools needed, e.g. 'Large skillet', 'Chef's knife & cutting board'"),
  ingredients: z.array(Line),
  steps: z.array(Step),
});

const SYSTEM = `You are a recipe editor for Forkcast, a meal-planning app for busy home cooks.
Rewrite the given recipe as a clean, original, easy-to-follow recipe using US customary units (lb, oz, cups, tbsp, tsp).

Rules:
- Scale the recipe to serve the requested number of people.
- Normalize sloppy or clearly wrong quantities to realistic amounts. (e.g. never "2 cups olive oil" in a savory dish — use a sensible "2 tbsp"; a 4-serving stew needs roughly 1.5 lb of meat, not 2 kg.)
- Write the method in YOUR OWN words as concise, numbered steps. Do NOT copy the source instructions verbatim — they are reference only.
- equipment: list the specific tools needed, complete but not padded.
- ingredients: every ingredient with a precise quantity and any prep ("1 onion, diced").
- For each step, "uses" lists exactly the ingredients first added in that step, each with the amount used there. Each ingredient appears in "uses" only once.
- totalTimeMinutes: a realistic total active + cook time.
Keep it practical, unfussy, and American home-cook friendly.`;

interface Args {
  limit?: number;
  force: boolean;
}
function parseArgs(): Args {
  const a = process.argv.slice(2);
  const out: Args = { force: a.includes("--force") };
  const li = a.indexOf("--limit");
  if (li !== -1 && a[li + 1]) out.limit = Number(a[li + 1]);
  return out;
}

async function pool<T>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<void>): Promise<void> {
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set. Add it to .env (ANTHROPIC_API_KEY=sk-ant-...) and re-run.");
    process.exit(1);
  }
  const args = parseArgs();
  const client = new Anthropic({ maxRetries: 4 });

  const recipes = await prisma.recipe.findMany({
    where: args.force ? {} : { enriched: null },
    include: { ingredients: { include: { ingredient: true } } },
    orderBy: { id: "asc" },
    ...(args.limit ? { take: args.limit } : {}),
  });

  console.log(`Enriching ${recipes.length} recipe(s) with claude-opus-4-8…\n`);

  let ok = 0;
  let failed = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  await pool(recipes, 4, async (r, idx) => {
    const ingredientLines = r.ingredients
      .map((ri) => `- ${ri.ingredient.displayName} — ${ri.rawMeasure || "to taste"}`)
      .join("\n");
    const userText = `Recipe: ${r.title}
Cuisine: ${r.area ?? "n/a"}
Serve: ${r.servings} people

Source ingredients (name — original measure):
${ingredientLines}

Source instructions (reference only — rewrite in your own words):
${r.instructions}`;

    try {
      const res = await client.messages.parse({
        model: "claude-opus-4-8",
        max_tokens: 4000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(Enriched) },
        system: SYSTEM,
        messages: [{ role: "user", content: userText }],
      });

      inputTokens += (res.usage.input_tokens ?? 0) + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
      outputTokens += res.usage.output_tokens ?? 0;

      const parsed = res.parsed_output;
      if (!parsed) {
        failed++;
        console.warn(`  ✗ ${r.title} — no structured output (stop: ${res.stop_reason})`);
        return;
      }
      await prisma.recipe.update({
        where: { id: r.id },
        data: { enriched: JSON.stringify(parsed), enrichedAt: new Date() },
      });
      ok++;
      if ((idx + 1) % 10 === 0 || ok + failed === recipes.length) {
        console.log(`  …${ok + failed}/${recipes.length} done (${ok} ok)`);
      }
    } catch (e) {
      failed++;
      console.warn(`  ✗ ${r.title} — ${(e as Error).message}`);
    }
  });

  const cost = (inputTokens / 1_000_000) * 5 + (outputTokens / 1_000_000) * 25;
  console.log(`\nDone. ${ok} enriched, ${failed} failed.`);
  console.log(`Tokens: ${inputTokens.toLocaleString()} in, ${outputTokens.toLocaleString()} out  ≈  $${cost.toFixed(2)}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
