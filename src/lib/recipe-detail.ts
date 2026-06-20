// Turns a stored recipe (free-text instructions + ingredient/measure list) into a
// proper step-by-step recipe: an equipment list, an ingredient list with quantities,
// and numbered steps annotated with which ingredients (and how much) come in when.
//
// This is deterministic and uses the real instructions already in our DB. A future
// LLM enrichment pass can replace it to normalize quantities and write original copy.

export interface RecipeIngredientLine {
  name: string;
  measure: string;
}

export interface RecipeStep {
  text: string;
  uses: RecipeIngredientLine[]; // ingredients introduced in this step, with quantity
}

export interface RecipeDetail {
  servings: number;
  totalTimeMinutes?: number; // set by the LLM enrichment pass; absent in the deterministic build
  equipment: string[];
  ingredients: RecipeIngredientLine[];
  steps: RecipeStep[];
}

// Parse an LLM-enriched recipe (stored on Recipe.enriched) back into a RecipeDetail,
// validating the basic shape so a malformed record falls back to the deterministic build.
export function parseEnriched(json: string | null): RecipeDetail | null {
  if (!json) return null;
  try {
    const d = JSON.parse(json) as RecipeDetail;
    if (!Array.isArray(d.steps) || !Array.isArray(d.ingredients) || !Array.isArray(d.equipment)) return null;
    if (d.steps.length === 0) return null;
    return {
      servings: typeof d.servings === "number" ? d.servings : 4,
      totalTimeMinutes: typeof d.totalTimeMinutes === "number" ? d.totalTimeMinutes : undefined,
      equipment: d.equipment.map(String),
      ingredients: d.ingredients.map((i) => ({ name: String(i.name), measure: String(i.measure) })),
      steps: d.steps.map((s) => ({
        text: String(s.text),
        uses: Array.isArray(s.uses) ? s.uses.map((u) => ({ name: String(u.name), measure: String(u.measure) })) : [],
      })),
    };
  } catch {
    return null;
  }
}

export interface DetailInput {
  servings: number;
  instructions: string;
  ingredients: { key: string; displayName: string; rawMeasure: string; isStaple: boolean }[];
}

// ---- Steps ----

function parseSteps(instructions: string): string[] {
  const raw = (instructions || "").replace(/\r/g, "\n");
  let parts = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // A single un-broken blob → split into sentences so it's still step-able.
  if (parts.length <= 1) {
    parts = (parts[0] || "")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return parts
    .map((p) =>
      p
        .replace(/^\s*(?:step\s*)?\d+\s*[.):\-]?\s*/i, "") // leading "1.", "Step 2:", "0)"
        .replace(/^[-•*]\s*/, "") // bullets
        .trim(),
    )
    .filter((p) => p.length > 1);
}

// ---- Equipment ----

const EQUIPMENT_PATTERNS: [string, RegExp][] = [
  ["Oven", /\boven\b|preheat|\bbake\b|\bbaked\b|\bbaking\b|\broast/],
  ["Baking dish", /baking dish|casserole dish|oven dish|gratin|ovenproof/],
  ["Sheet pan", /baking (?:tray|sheet)|sheet pan|tray ?bake|roasting (?:tin|pan|tray)/],
  ["Skillet / frying pan", /frying pan|fry pan|\bskillet\b|saut[eé] pan|pan[ -]fry|\bsear\b|\bfry\b/],
  ["Saucepan", /saucepan|sauce pan/],
  ["Large pot", /\bpot\b|stockpot|\bboil\b|\bsimmer\b/],
  ["Casserole / Dutch oven", /casserole|dutch oven|flameproof/],
  ["Pressure cooker", /pressure cooker|instant pot|pressure[- ]cook/],
  ["Slow cooker", /slow cooker|crock ?pot/],
  ["Wok", /\bwok\b|stir[- ]?fry/],
  ["Grill / griddle", /\bgrill\b|griddle|barbecue|\bbbq\b/],
  ["Blender", /\bblender\b|\bblend\b|liquidi[sz]/],
  ["Food processor", /food processor/],
  ["Mixing bowl", /mixing bowl|large bowl|\bbowl\b|marinate|marinade|\bwhisk\b|\bcombine\b/],
  ["Colander / sieve", /colander|\bsieve\b|\bstrain\b|\bdrain\b/],
  ["Grater", /\bgrate\b|grated|grater|\bzest\b/],
  ["Rolling pin", /rolling pin|roll out/],
];

function detectEquipment(instructions: string): string[] {
  const t = (instructions || "").toLowerCase();
  const out: string[] = [];
  for (const [name, re] of EQUIPMENT_PATTERNS) if (re.test(t) && !out.includes(name)) out.push(name);
  if (/\bchop|\bslice|\bdice|\bcut\b|\bmince|\bpeel/.test(t)) out.unshift("Knife & cutting board");
  if (out.length === 0) out.push("Large pan", "Knife & cutting board");
  // De-dupe while preserving order (unshift may duplicate).
  return [...new Set(out)];
}

// ---- Ingredient → step matching ----

const GENERIC_TOKENS = new Set([
  "oil", "salt", "pepper", "water", "sugar", "sauce", "stock", "fresh", "ground", "dried",
  "powder", "seeds", "leaves", "whole", "large", "small", "good", "quality", "extra",
]);

function ingredientTokens(key: string, displayName: string): string[] {
  const toks = new Set<string>();
  const k = key.toLowerCase().trim();
  const d = displayName.toLowerCase().trim();
  if (k.length >= 3) toks.add(k);
  if (d.length >= 3) toks.add(d);
  for (const w of `${k} ${d}`.split(/[^a-z]+/)) {
    if (w.length >= 4 && !GENERIC_TOKENS.has(w)) toks.add(w);
  }
  return [...toks];
}

function stepUses(stepLower: string, tokens: string[]): boolean {
  return tokens.some((t) => stepLower.includes(t));
}

function cleanMeasure(raw: string): string {
  const m = (raw || "").replace(/\s+/g, " ").trim();
  return m || "to taste";
}

// ---- Build ----

export function buildRecipeDetail(input: DetailInput): RecipeDetail {
  const steps = parseSteps(input.instructions);
  const equipment = detectEquipment(input.instructions);

  const ingredients: RecipeIngredientLine[] = input.ingredients.map((i) => ({
    name: i.displayName,
    measure: cleanMeasure(i.rawMeasure),
  }));

  const tokensByIndex = input.ingredients.map((i) => ingredientTokens(i.key, i.displayName));

  // Attach each ingredient to the FIRST step that mentions it (that's where the
  // quantity matters — "when, and how much").
  const claimed = new Set<number>();
  const annotated: RecipeStep[] = steps.map((text) => {
    const lower = text.toLowerCase();
    const uses: RecipeIngredientLine[] = [];
    input.ingredients.forEach((ing, idx) => {
      if (claimed.has(idx)) return;
      if (stepUses(lower, tokensByIndex[idx])) {
        claimed.add(idx);
        uses.push({ name: ing.displayName, measure: cleanMeasure(ing.rawMeasure) });
      }
    });
    return { text, uses };
  });

  return {
    servings: input.servings,
    equipment,
    ingredients,
    steps: annotated.length ? annotated : [{ text: input.instructions.trim() || "No instructions available.", uses: [] }],
  };
}
