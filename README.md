# Forkcast

**Plan once. Eat all week.** Forkcast decides a week of dinners whose ingredients overlap, then hands you one aisle-sorted grocery list (with the cost up front) and a ~90-minute Sunday prep schedule.

This repo currently contains a working **prototype of the core engine, made visible** — you set your preferences in the browser and watch a real plan generate from real recipe data.

## Run it on your machine

```bash
npm install        # one time — installs dependencies
npm run dev        # start the app
```

Then open **http://localhost:3000** and click **Plan my week**.

## What's inside

| Piece | What it is | Where |
| --- | --- | --- |
| **The app** | The screen you set preferences on and see the plan/list/prep | `src/app/page.tsx` |
| **The overlap engine** (core IP) | Picks dinners that share ingredients, builds the list + prep schedule | `src/lib/engine.ts` |
| **Ingredient catalog** (owned asset) | Maps messy recipe ingredients → canonical items with aisle, price, staple flag | `src/lib/ingredient-catalog.ts` |
| **Database** | Our own copy of recipes + ingredients (SQLite for now) | `prisma/schema.prisma`, `dev.db` |

## The recipe data

Recipes come from a free public source (TheMealDB) and are ingested into **our own database** — so we're not dependent on anyone's API long-term. The valuable, owned layer is the ingredient catalog (aisle + price + staple), which is what makes the cost estimate and aisle-sorting possible.

```bash
npm run ingest     # pull recipes from TheMealDB into the database
npm run retag      # re-apply the ingredient catalog (aisle/price) to existing data
npm run db:studio  # browse the database in a visual editor
```

The database already has ~370 recipes ingested, so you don't need to run these to use the app.

### Upgrading the recipes with AI (optional, costs a few dollars)

Out of the box, recipes use the public source's instructions, which sometimes have sloppy
quantities. `npm run enrich` rewrites each recipe with Claude into a clean, **original**,
step-by-step recipe with normalized quantities, a tools list, and per-step ingredient amounts —
then the app uses those automatically.

1. Get an API key at **console.anthropic.com** → API keys.
2. Add it to the `.env` file: `ANTHROPIC_API_KEY=sk-ant-...`
3. Test on 5 recipes first, then run the rest:

```bash
npm run enrich -- --limit 5   # cheap test — check the results look good
npm run enrich                # enrich the rest (~$10–15 of API usage for all ~370)
```

It prints the token cost when it finishes. The app falls back to the original recipes for
anything not yet enriched, so you can run it in batches.

## Tech

Next.js + TypeScript, Prisma 6 + SQLite (→ Postgres in production), Tailwind. Chosen for long-term maintainability over novelty.

## Not built yet (deliberately deferred)

Accounts/login, Stripe billing, the weekly "here's your plan" email, per-meal swap (regenerate-the-whole-plan works today), installable PWA, and the production Postgres deployment. These come after the engine is proven.
