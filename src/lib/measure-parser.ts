// Parses TheMealDB's free-text measures ("2 cups", "1 1/2 lb", "400g", "to taste")
// into a rough { quantity, unit }. Best-effort: many measures are vague, so both
// fields are optional. We don't rely on this for grocery cost (that uses the
// pack-price model in the ingredient catalog) — it's for display and future scaling.

export interface ParsedMeasure {
  quantity: number | null;
  unit: string | null;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25,
  "½": 0.5,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
};

// Words we treat as a unit if they show up after a number.
const KNOWN_UNITS = new Set([
  "g", "gram", "grams", "kg", "kgs", "kilogram",
  "ml", "l", "litre", "litres", "liter",
  "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
  "tsp", "teaspoon", "teaspoons", "tbs", "tbsp", "tablespoon", "tablespoons",
  "cup", "cups", "pinch", "dash", "clove", "cloves",
  "can", "cans", "tin", "tins", "jar", "jars", "pack", "packet", "packets",
  "slice", "slices", "stick", "sticks", "sprig", "sprigs", "bunch", "handful",
  "whole", "large", "medium", "small",
]);

export function parseMeasure(raw: string): ParsedMeasure {
  const text = (raw || "").trim().toLowerCase();
  if (!text) return { quantity: null, unit: null };

  let rest = text;
  let quantity: number | null = null;

  // Leading unicode fraction, e.g. "½ cup".
  const firstChar = rest[0];
  if (UNICODE_FRACTIONS[firstChar] !== undefined) {
    quantity = UNICODE_FRACTIONS[firstChar];
    rest = rest.slice(1).trim();
  } else {
    // Match a number that may be a mixed fraction ("1 1/2"), simple fraction
    // ("1/2"), decimal ("0.5") or integer ("2").
    const m = rest.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+)/);
    if (m) {
      quantity = evalNumber(m[1]);
      rest = rest.slice(m[0].length).trim();
    }
  }

  // First remaining word that looks like a unit.
  let unit: string | null = null;
  const firstWord = rest.split(/[\s.,]+/)[0];
  if (firstWord && KNOWN_UNITS.has(firstWord)) {
    unit = firstWord.replace(/s$/, ""); // singularize lightly
  }

  return { quantity, unit };
}

function evalNumber(token: string): number {
  if (token.includes(" ")) {
    const [whole, frac] = token.split(/\s+/);
    return Number(whole) + fractionToNumber(frac);
  }
  if (token.includes("/")) return fractionToNumber(token);
  return Number(token);
}

function fractionToNumber(frac: string): number {
  const [n, d] = frac.split("/").map(Number);
  return d ? n / d : 0;
}
