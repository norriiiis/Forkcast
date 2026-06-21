// Curated USDA-derived per-100g nutrition for the canonical ingredient catalog.
//
// These are reference values from USDA FoodData Central (SR Legacy / Foundation),
// embedded so per-meal nutrition works the moment the feature ships — before, or
// without, running the live FDC backfill (scripts/nutrition.ts), which overrides
// these per ingredient with authoritative data + portion gram-weights.
//
// Values are per 100g of the ingredient as typically purchased (raw proteins, dry
// grains/pasta, drained canned beans). `gramsEach` is the weight of one countable
// unit ("1 onion"); `density` (g/ml) scales volume measures for liquids/oils.

import type { IngredientNutrition, NutritionPanel } from "@/lib/nutrition";

type Row = { per100g: Partial<NutritionPanel>; gramsEach?: number; density?: number };

// Keyed by the catalog's canonical ingredient `key` (see ingredient-catalog.ts).
const CURATED: Record<string, Row> = {
  // ---- Meat & Seafood (raw) ----
  "chicken breast": { per100g: { kcal: 120, protein: 22.5, fat: 2.6, sodium: 45, potassium: 334, cholesterol: 73 } },
  "chicken thighs": { per100g: { kcal: 121, protein: 19.7, fat: 4.1, sodium: 86, potassium: 230, cholesterol: 92 } },
  chicken: { per100g: { kcal: 190, protein: 18, fat: 12, sodium: 70, potassium: 189, cholesterol: 76 } },
  "ground beef": { per100g: { kcal: 254, protein: 17, fat: 20, satFat: 7.7, sodium: 66, iron: 2, potassium: 270, cholesterol: 71 } },
  beef: { per100g: { kcal: 187, protein: 21, fat: 11, satFat: 4.3, iron: 2.3, potassium: 330, cholesterol: 62 } },
  pork: { per100g: { kcal: 180, protein: 20, fat: 11, satFat: 3.8, sodium: 50, potassium: 360, cholesterol: 63 } },
  "ground pork": { per100g: { kcal: 263, protein: 17, fat: 21, satFat: 7.9, sodium: 56, cholesterol: 72 } },
  sausage: { per100g: { kcal: 300, protein: 12, fat: 27, satFat: 9.9, sodium: 700, cholesterol: 71 } },
  bacon: { per100g: { kcal: 458, protein: 12, fat: 45, satFat: 15, sodium: 1100, cholesterol: 66 } },
  chorizo: { per100g: { kcal: 455, protein: 24, fat: 38, satFat: 14, sodium: 1240, cholesterol: 88 } },
  ham: { per100g: { kcal: 145, protein: 21, fat: 6, sodium: 1200, cholesterol: 53 } },
  lamb: { per100g: { kcal: 230, protein: 17, fat: 17, satFat: 7.5, iron: 1.6, potassium: 222, cholesterol: 73 } },
  turkey: { per100g: { kcal: 148, protein: 20, fat: 7, sodium: 70, potassium: 230, cholesterol: 70 } },
  salmon: { per100g: { kcal: 208, protein: 20, fat: 13, satFat: 3.1, potassium: 363, vitaminD: 11, cholesterol: 55 } },
  "white fish": { per100g: { kcal: 82, protein: 18, fat: 0.7, potassium: 413, cholesterol: 43 } },
  shrimp: { per100g: { kcal: 85, protein: 20, fat: 0.5, sodium: 119, potassium: 264, cholesterol: 161 } },

  // ---- Dairy & Eggs ----
  eggs: { per100g: { kcal: 143, protein: 12.6, fat: 9.5, satFat: 3.1, sodium: 142, calcium: 56, vitaminD: 2, cholesterol: 372 }, gramsEach: 50 },
  milk: { per100g: { kcal: 61, protein: 3.2, fat: 3.3, satFat: 1.9, carb: 4.8, sugar: 5, calcium: 113, vitaminD: 1.3, cholesterol: 10 }, density: 1.03 },
  butter: { per100g: { kcal: 717, protein: 0.9, fat: 81, satFat: 51, sodium: 11, calcium: 24, cholesterol: 215 }, density: 0.91 },
  cheddar: { per100g: { kcal: 403, protein: 23, fat: 33, satFat: 21, sodium: 621, calcium: 721, cholesterol: 105 } },
  parmesan: { per100g: { kcal: 431, protein: 38, fat: 29, satFat: 19, sodium: 1529, calcium: 1184, cholesterol: 88 } },
  mozzarella: { per100g: { kcal: 300, protein: 22, fat: 22, satFat: 13, sodium: 627, calcium: 505, cholesterol: 79 } },
  cream: { per100g: { kcal: 340, protein: 2.8, fat: 36, satFat: 23, carb: 2.8, calcium: 66, cholesterol: 113 }, density: 1.0 },
  "sour cream": { per100g: { kcal: 198, protein: 2.4, fat: 19, satFat: 12, carb: 4.6, calcium: 101, cholesterol: 52 } },
  yogurt: { per100g: { kcal: 97, protein: 9, fat: 5, satFat: 3.3, carb: 3.6, sugar: 3.2, calcium: 100, cholesterol: 13 } },
  "cream cheese": { per100g: { kcal: 342, protein: 6, fat: 34, satFat: 19, sodium: 321, calcium: 98, cholesterol: 101 } },
  feta: { per100g: { kcal: 264, protein: 14, fat: 21, satFat: 15, sodium: 1116, calcium: 493, cholesterol: 89 } },

  // ---- Bakery (gramsEach = one piece) ----
  bread: { per100g: { kcal: 265, protein: 9, fat: 3.2, carb: 49, fiber: 2.7, sugar: 5, sodium: 491, calcium: 144, iron: 3.6 }, gramsEach: 32 },
  tortillas: { per100g: { kcal: 304, protein: 8, fat: 7, carb: 51, fiber: 3, sodium: 600, iron: 3.2 }, gramsEach: 45 },
  "burger buns": { per100g: { kcal: 280, protein: 9, fat: 4, carb: 50, fiber: 2, sugar: 6, sodium: 480 }, gramsEach: 50 },
  naan: { per100g: { kcal: 310, protein: 9, fat: 6, carb: 53, fiber: 2, sodium: 450 }, gramsEach: 90 },
  pita: { per100g: { kcal: 275, protein: 9, fat: 1.2, carb: 56, fiber: 2.2, sodium: 536 }, gramsEach: 60 },

  // ---- Pantry: grains, legumes, cans (dry/drained as purchased) ----
  rice: { per100g: { kcal: 365, protein: 7, fat: 0.7, carb: 80, fiber: 1.3, iron: 4.2 } },
  pasta: { per100g: { kcal: 371, protein: 13, fat: 1.5, carb: 75, fiber: 3.2, iron: 3.3 } },
  noodles: { per100g: { kcal: 384, protein: 14, fat: 4.4, carb: 71, fiber: 3.3, iron: 3.6 } },
  "canned tomatoes": { per100g: { kcal: 32, protein: 1.6, fat: 0.3, carb: 7, fiber: 1.9, sugar: 4, sodium: 130, potassium: 220, vitaminC: 14 } },
  "tomato paste": { per100g: { kcal: 82, protein: 4.3, fat: 0.5, carb: 19, fiber: 4, sugar: 12, sodium: 59, potassium: 1014, vitaminC: 22 } },
  passata: { per100g: { kcal: 35, protein: 1.6, fat: 0.2, carb: 7, fiber: 1.6, sugar: 5, sodium: 230, potassium: 300 } },
  "coconut milk": { per100g: { kcal: 197, protein: 2, fat: 21, satFat: 18, carb: 3, sodium: 15 } },
  chickpeas: { per100g: { kcal: 139, protein: 7.4, fat: 2.6, carb: 22, fiber: 6, sodium: 240, iron: 1.8, potassium: 173 } },
  "kidney beans": { per100g: { kcal: 127, protein: 8.7, fat: 0.5, carb: 23, fiber: 7, sodium: 290, iron: 2.4, potassium: 403 } },
  "black beans": { per100g: { kcal: 132, protein: 8.9, fat: 0.5, carb: 24, fiber: 8.7, sodium: 230, iron: 2.1, potassium: 355 } },
  "white beans": { per100g: { kcal: 114, protein: 8, fat: 0.4, carb: 21, fiber: 5, sodium: 290, iron: 2.5, potassium: 389 } },
  lentils: { per100g: { kcal: 352, protein: 25, fat: 1, carb: 63, fiber: 11, iron: 6.5, potassium: 677 } },
  "peanut butter": { per100g: { kcal: 588, protein: 25, fat: 50, satFat: 10, carb: 20, fiber: 6, sugar: 9, sodium: 459, potassium: 649 } },
  breadcrumbs: { per100g: { kcal: 395, protein: 14, fat: 5, carb: 72, fiber: 4.5, sodium: 732, iron: 5 } },
  oats: { per100g: { kcal: 389, protein: 17, fat: 7, carb: 66, fiber: 11, iron: 4.7, potassium: 429 } },
  couscous: { per100g: { kcal: 376, protein: 13, fat: 0.6, carb: 77, fiber: 5 } },
  quinoa: { per100g: { kcal: 368, protein: 14, fat: 6, carb: 64, fiber: 7, iron: 4.6, potassium: 563 } },
  gnocchi: { per100g: { kcal: 160, protein: 4, fat: 1, carb: 33, fiber: 2, sodium: 380 } },
  nuts: { per100g: { kcal: 579, protein: 21, fat: 50, satFat: 3.8, carb: 22, fiber: 12, calcium: 269, iron: 3.7, potassium: 733 } },
  coconut: { per100g: { kcal: 660, protein: 6.9, fat: 65, satFat: 57, carb: 24, fiber: 16 } },
  raisins: { per100g: { kcal: 299, protein: 3.1, fat: 0.5, carb: 79, fiber: 3.7, sugar: 59, potassium: 749 } },
  wine: { per100g: { kcal: 83, protein: 0.1, carb: 2.6, sugar: 0.6 }, density: 0.99 },

  // ---- Pantry staples that meaningfully affect nutrition ----
  "olive oil": { per100g: { kcal: 884, fat: 100, satFat: 14 }, density: 0.92 },
  "vegetable oil": { per100g: { kcal: 884, fat: 100, satFat: 15 }, density: 0.92 },
  "sesame oil": { per100g: { kcal: 884, fat: 100, satFat: 14 }, density: 0.92 },
  "soy sauce": { per100g: { kcal: 53, protein: 8, carb: 5, sodium: 5493 }, density: 1.1 },
  "fish sauce": { per100g: { kcal: 35, protein: 5, carb: 4, sodium: 7851 }, density: 1.1 },
  honey: { per100g: { kcal: 304, carb: 82, sugar: 82 }, density: 1.42 },
  sugar: { per100g: { kcal: 387, carb: 100, sugar: 100 } },
  flour: { per100g: { kcal: 364, protein: 10, fat: 1, carb: 76, fiber: 2.7, iron: 4.6 } },
  salt: { per100g: { sodium: 38758 }, density: 1.2 },
  stock: { per100g: { kcal: 4, protein: 0.6, sodium: 350 }, density: 1.0 },
  ketchup: { per100g: { kcal: 101, protein: 1.2, carb: 27, sugar: 22, sodium: 907 }, density: 1.14 },
  mustard: { per100g: { kcal: 66, protein: 4, fat: 4, carb: 5, sodium: 1135 } },
  mayonnaise: { per100g: { kcal: 680, protein: 1, fat: 75, satFat: 12, sodium: 635, cholesterol: 42 }, density: 0.91 },

  // ---- Produce (per 100g; gramsEach = one item) ----
  onion: { per100g: { kcal: 40, protein: 1.1, carb: 9.3, fiber: 1.7, sugar: 4.2, vitaminC: 7.4, potassium: 146 }, gramsEach: 110 },
  "green onions": { per100g: { kcal: 32, protein: 1.8, carb: 7.3, fiber: 2.6, vitaminC: 18.8, vitaminA: 50, potassium: 276 }, gramsEach: 50 },
  garlic: { per100g: { kcal: 149, protein: 6.4, carb: 33, fiber: 2.1, vitaminC: 31, calcium: 181, potassium: 401 }, gramsEach: 3 },
  ginger: { per100g: { kcal: 80, protein: 1.8, carb: 18, fiber: 2, vitaminC: 5, potassium: 415 }, gramsEach: 30 },
  tomato: { per100g: { kcal: 18, protein: 0.9, carb: 3.9, fiber: 1.2, sugar: 2.6, vitaminC: 14, vitaminA: 42, potassium: 237 }, gramsEach: 123 },
  "cherry tomatoes": { per100g: { kcal: 18, protein: 0.9, carb: 3.9, fiber: 1.2, sugar: 2.6, vitaminC: 14, vitaminA: 42, potassium: 237 }, gramsEach: 150 },
  potato: { per100g: { kcal: 77, protein: 2, carb: 17, fiber: 2.2, vitaminC: 19.7, potassium: 425, iron: 0.8 }, gramsEach: 170 },
  "baby potatoes": { per100g: { kcal: 77, protein: 2, carb: 17, fiber: 2.2, vitaminC: 19.7, potassium: 425 }, gramsEach: 200 },
  "sweet potato": { per100g: { kcal: 86, protein: 1.6, carb: 20, fiber: 3, sugar: 4.2, vitaminA: 709, vitaminC: 2.4, potassium: 337 }, gramsEach: 130 },
  carrot: { per100g: { kcal: 41, protein: 0.9, carb: 10, fiber: 2.8, sugar: 4.7, vitaminA: 835, vitaminC: 6, potassium: 320 }, gramsEach: 61 },
  celery: { per100g: { kcal: 16, protein: 0.7, carb: 3, fiber: 1.6, sodium: 80, potassium: 260, vitaminC: 3.1 }, gramsEach: 40 },
  "bell pepper": { per100g: { kcal: 31, protein: 1, carb: 6, fiber: 2.1, sugar: 4.2, vitaminC: 128, vitaminA: 157, potassium: 211 }, gramsEach: 119 },
  chili: { per100g: { kcal: 40, protein: 1.9, carb: 9, fiber: 1.5, vitaminC: 144, vitaminA: 48, potassium: 322 }, gramsEach: 15 },
  mushroom: { per100g: { kcal: 22, protein: 3.1, carb: 3.3, fiber: 1, potassium: 318, vitaminD: 0.2 }, gramsEach: 60 },
  spinach: { per100g: { kcal: 23, protein: 2.9, carb: 3.6, fiber: 2.2, iron: 2.7, vitaminA: 469, vitaminC: 28, calcium: 99, potassium: 558 }, gramsEach: 60 },
  lettuce: { per100g: { kcal: 15, protein: 1.4, carb: 2.9, fiber: 1.3, vitaminA: 370, vitaminC: 9, potassium: 194 }, gramsEach: 80 },
  cucumber: { per100g: { kcal: 15, protein: 0.7, carb: 3.6, fiber: 0.5, vitaminC: 2.8, potassium: 147 }, gramsEach: 200 },
  broccoli: { per100g: { kcal: 34, protein: 2.8, carb: 7, fiber: 2.6, vitaminC: 89, vitaminA: 31, calcium: 47, potassium: 316 }, gramsEach: 150 },
  cauliflower: { per100g: { kcal: 25, protein: 1.9, carb: 5, fiber: 2, vitaminC: 48, potassium: 299 }, gramsEach: 200 },
  zucchini: { per100g: { kcal: 17, protein: 1.2, carb: 3.1, fiber: 1, vitaminC: 17.9, potassium: 261 }, gramsEach: 196 },
  eggplant: { per100g: { kcal: 25, protein: 1, carb: 6, fiber: 3, potassium: 229 }, gramsEach: 250 },
  "green beans": { per100g: { kcal: 31, protein: 1.8, carb: 7, fiber: 3.4, vitaminC: 12.2, vitaminA: 35, potassium: 211 }, gramsEach: 100 },
  cabbage: { per100g: { kcal: 25, protein: 1.3, carb: 6, fiber: 2.5, vitaminC: 36, potassium: 170 }, gramsEach: 150 },
  kale: { per100g: { kcal: 35, protein: 2.9, carb: 4.4, fiber: 4.1, vitaminC: 93, vitaminA: 500, calcium: 254, potassium: 348 }, gramsEach: 67 },
  leek: { per100g: { kcal: 61, protein: 1.5, carb: 14, fiber: 1.8, vitaminA: 83, vitaminC: 12, potassium: 180 }, gramsEach: 89 },
  shallot: { per100g: { kcal: 72, protein: 2.5, carb: 17, fiber: 3.2, vitaminC: 8, potassium: 334 }, gramsEach: 30 },
  lemon: { per100g: { kcal: 29, protein: 1.1, carb: 9, fiber: 2.8, sugar: 2.5, vitaminC: 53, potassium: 138 }, gramsEach: 58, density: 1.03 },
  lime: { per100g: { kcal: 30, protein: 0.7, carb: 11, fiber: 2.8, vitaminC: 29, potassium: 102 }, gramsEach: 67, density: 1.03 },
  avocado: { per100g: { kcal: 160, protein: 2, fat: 15, satFat: 2.1, carb: 9, fiber: 7, potassium: 485, vitaminC: 10 }, gramsEach: 150 },
  cilantro: { per100g: { kcal: 23, protein: 2.1, carb: 3.7, fiber: 2.8, vitaminA: 337, vitaminC: 27, potassium: 521 }, gramsEach: 20 },
  parsley: { per100g: { kcal: 36, protein: 3, carb: 6, fiber: 3.3, vitaminA: 421, vitaminC: 133, iron: 6.2, potassium: 554 }, gramsEach: 20 },
  basil: { per100g: { kcal: 23, protein: 3.2, carb: 2.7, fiber: 1.6, vitaminA: 264, vitaminC: 18, calcium: 177, potassium: 295 }, gramsEach: 10 },
  mint: { per100g: { kcal: 70, protein: 3.8, carb: 15, fiber: 8, vitaminA: 212, potassium: 569 }, gramsEach: 15 },
  "butternut squash": { per100g: { kcal: 45, protein: 1, carb: 12, fiber: 2, vitaminA: 532, vitaminC: 21, potassium: 352 }, gramsEach: 600 },
  corn: { per100g: { kcal: 86, protein: 3.2, carb: 19, fiber: 2.7, sugar: 3.2, vitaminC: 6.8, potassium: 270 }, gramsEach: 150 },
  apple: { per100g: { kcal: 52, protein: 0.3, carb: 14, fiber: 2.4, sugar: 10, vitaminC: 4.6, potassium: 107 }, gramsEach: 182 },

  // ---- Frozen ----
  peas: { per100g: { kcal: 81, protein: 5.4, carb: 14, fiber: 5.5, sugar: 5.7, vitaminC: 40, vitaminA: 38, iron: 1.5, potassium: 110 }, gramsEach: 100 },
};

/** USDA-derived fallback nutrition for a catalog ingredient, or null if uncurated. */
export function curatedNutrition(key: string): IngredientNutrition | null {
  const row = CURATED[key];
  if (!row) return null;
  return { source: "curated", per100g: row.per100g, gramsEach: row.gramsEach, density: row.density };
}
