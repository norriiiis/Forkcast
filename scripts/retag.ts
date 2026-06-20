// Re-resolve every ingredient already in the DB through the (possibly improved)
// catalog, updating aisle / staple / price / display name. Lets us refine the
// catalog without re-fetching from the network.
//
// Run with:  npx tsx scripts/retag.ts

import { prisma } from "../src/lib/db";
import { resolveIngredient } from "../src/lib/ingredient-catalog";

async function main() {
  const all = await prisma.ingredient.findMany();
  let changed = 0;
  for (const ing of all) {
    const r = resolveIngredient(ing.name);
    const needsUpdate =
      r.aisle !== ing.aisle ||
      r.isStaple !== ing.isStaple ||
      r.packPriceCents !== ing.packPriceCents ||
      r.packLabel !== ing.packLabel ||
      r.displayName !== ing.displayName;
    if (needsUpdate) {
      await prisma.ingredient.update({
        where: { id: ing.id },
        data: {
          aisle: r.aisle,
          isStaple: r.isStaple,
          packPriceCents: r.packPriceCents,
          packLabel: r.packLabel,
          displayName: r.displayName,
        },
      });
      changed++;
    }
  }
  console.log(`Re-tagged ${changed} of ${all.length} ingredients.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
