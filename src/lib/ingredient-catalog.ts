// The owned asset behind Forkcast's cost + aisle features.
//
// Public recipe data (TheMealDB) gives messy ingredient strings with no aisle and
// no price. This catalog resolves those strings to canonical grocery items, each
// tagged with: the aisle you'd find it in, a typical "pack price" (what one grocery
// purchase costs — you buy a pack of chicken whether a recipe uses half of it), and
// whether it's a pantry staple you almost certainly already have on hand.
//
// Cost model: the weekly grocery total = sum of the pack price of each DISTINCT
// non-staple ingredient. This is what makes ingredient overlap save money — reusing
// one chicken across three dinners is one purchase, not three.

export const AISLES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Bakery",
  "Pantry",
  "Spices & Baking",
  "Frozen",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

export function aisleOrder(aisle: string): number {
  const i = (AISLES as readonly string[]).indexOf(aisle);
  return i === -1 ? AISLES.length : i;
}

export interface CatalogEntry {
  key: string; // canonical, lowercased
  displayName: string;
  aisle: Aisle;
  isStaple: boolean;
  packPriceCents: number;
  packLabel: string;
  aliases: string[];
}

type Row = { k: string; d: string; p: number; pack: string; a?: string[] };

function group(aisle: Aisle, isStaple: boolean, rows: Row[]): CatalogEntry[] {
  return rows.map((r) => ({
    key: r.k,
    displayName: r.d,
    aisle,
    isStaple,
    packPriceCents: r.p,
    packLabel: r.pack,
    aliases: r.a ?? [],
  }));
}

export const CATALOG: CatalogEntry[] = [
  // ---- Produce ----
  ...group("Produce", false, [
    { k: "onion", d: "Onion", p: 90, pack: "1 onion", a: ["onions", "red onion", "red onions", "yellow onion", "white onion", "brown onion", "spanish onion"] },
    { k: "green onions", d: "Green Onions", p: 130, pack: "1 bunch", a: ["spring onion", "spring onions", "scallion", "scallions"] },
    { k: "garlic", d: "Garlic", p: 90, pack: "1 head", a: ["garlic clove", "garlic cloves", "cloves garlic", "minced garlic", "garlic minced"] },
    { k: "ginger", d: "Fresh Ginger", p: 110, pack: "1 knob", a: ["fresh ginger", "ginger root", "root ginger"] },
    { k: "tomato", d: "Tomato", p: 110, pack: "1 tomato", a: ["tomatoes", "fresh tomatoes", "vine tomatoes"] },
    { k: "cherry tomatoes", d: "Cherry Tomatoes", p: 400, pack: "1 pint", a: ["cherry tomato", "baby tomatoes"] },
    { k: "potato", d: "Potato", p: 70, pack: "1 potato", a: ["potatoes", "baking potato", "white potato", "russet potato"] },
    { k: "baby potatoes", d: "Baby Potatoes", p: 500, pack: "1.5 lb bag", a: ["new potatoes", "baby potato"] },
    { k: "sweet potato", d: "Sweet Potato", p: 130, pack: "1 each", a: ["sweet potatoes", "yam"] },
    { k: "carrot", d: "Carrot", p: 50, pack: "1 carrot", a: ["carrots"] },
    { k: "celery", d: "Celery", p: 280, pack: "1 bunch", a: ["celery stalk", "celery stalks", "celery sticks"] },
    { k: "bell pepper", d: "Bell Pepper", p: 160, pack: "1 pepper", a: ["pepper", "peppers", "red pepper", "green pepper", "yellow pepper", "capsicum", "bell peppers", "red bell pepper", "green bell pepper"] },
    { k: "chili", d: "Fresh Chili", p: 60, pack: "1 each", a: ["chilli", "red chili", "red chilli", "green chili", "green chilli", "fresh chilli", "jalapeno", "jalapenos", "birds eye chilli"] },
    { k: "mushroom", d: "Mushrooms", p: 320, pack: "8 oz pack", a: ["mushrooms", "button mushrooms", "chestnut mushrooms", "white mushrooms"] },
    { k: "spinach", d: "Spinach", p: 380, pack: "1 bag", a: ["baby spinach", "fresh spinach"] },
    { k: "lettuce", d: "Lettuce", p: 250, pack: "1 head", a: ["romaine", "iceberg lettuce", "romaine lettuce"] },
    { k: "cucumber", d: "Cucumber", p: 110, pack: "1 each", a: ["cucumbers"] },
    { k: "broccoli", d: "Broccoli", p: 260, pack: "1 crown", a: ["tenderstem broccoli", "broccoli florets"] },
    { k: "cauliflower", d: "Cauliflower", p: 380, pack: "1 head", a: [] },
    { k: "zucchini", d: "Zucchini", p: 110, pack: "1 each", a: ["courgette", "courgettes", "zucchinis"] },
    { k: "eggplant", d: "Eggplant", p: 200, pack: "1 each", a: ["aubergine", "aubergines"] },
    { k: "green beans", d: "Green Beans", p: 320, pack: "12 oz pack", a: ["string beans", "french beans"] },
    { k: "cabbage", d: "Cabbage", p: 300, pack: "1 head", a: ["white cabbage", "savoy cabbage"] },
    { k: "kale", d: "Kale", p: 350, pack: "1 bag", a: [] },
    { k: "leek", d: "Leek", p: 180, pack: "1 each", a: ["leeks"] },
    { k: "shallot", d: "Shallot", p: 120, pack: "1 each", a: ["shallots", "echalion"] },
    { k: "lemon", d: "Lemon", p: 80, pack: "1 lemon", a: ["lemons", "lemon juice", "juice of a lemon"] },
    { k: "lime", d: "Lime", p: 60, pack: "1 lime", a: ["limes", "lime juice"] },
    { k: "avocado", d: "Avocado", p: 170, pack: "1 each", a: ["avocados"] },
    { k: "cilantro", d: "Cilantro / Coriander", p: 110, pack: "1 bunch", a: ["coriander", "fresh coriander", "coriander leaves", "fresh cilantro"] },
    { k: "parsley", d: "Parsley", p: 110, pack: "1 bunch", a: ["fresh parsley", "flat leaf parsley", "flat-leaf parsley"] },
    { k: "basil", d: "Fresh Basil", p: 320, pack: "1 pack", a: ["fresh basil", "basil leaves"] },
    { k: "mint", d: "Fresh Mint", p: 280, pack: "1 bunch", a: ["fresh mint", "mint leaves"] },
    { k: "butternut squash", d: "Butternut Squash", p: 380, pack: "1 each", a: ["squash"] },
    { k: "corn", d: "Corn", p: 180, pack: "1 can / 2 ears", a: ["sweetcorn", "corn on the cob", "sweet corn", "corn kernels"] },
    { k: "apple", d: "Apple", p: 80, pack: "1 each", a: ["apples"] },
  ]),

  // ---- Meat & Seafood ----
  ...group("Meat & Seafood", false, [
    { k: "chicken breast", d: "Chicken Breast", p: 1150, pack: "~2 lb pack", a: ["chicken breasts", "boneless chicken breast", "skinless chicken breast", "chicken breast fillets"] },
    { k: "chicken thighs", d: "Chicken Thighs", p: 850, pack: "~2 lb pack", a: ["chicken thigh", "boneless chicken thighs", "chicken thigh fillets"] },
    { k: "chicken", d: "Whole Chicken", p: 1300, pack: "1 whole (~5 lb)", a: ["whole chicken", "chicken pieces", "chicken legs", "chicken drumsticks"] },
    { k: "ground beef", d: "Ground Beef", p: 850, pack: "~1.25 lb", a: ["beef mince", "minced beef", "mince", "ground meat", "lean mince"] },
    { k: "beef", d: "Beef (Steak/Stewing)", p: 1400, pack: "~1.5 lb", a: ["stewing beef", "braising steak", "beef chunks", "steak", "sirloin", "rump steak", "beef brisket", "diced beef", "beef short rib", "beef fillet"] },
    { k: "pork", d: "Pork", p: 850, pack: "~1.5 lb", a: ["pork chops", "pork loin", "pork shoulder", "pork belly", "pork fillet", "pork tenderloin"] },
    { k: "ground pork", d: "Ground Pork", p: 700, pack: "1 lb", a: ["pork mince", "minced pork"] },
    { k: "sausage", d: "Sausages", p: 700, pack: "1 pack", a: ["sausages", "italian sausage", "pork sausages", "sausage meat"] },
    { k: "bacon", d: "Bacon", p: 750, pack: "1 pack", a: ["streaky bacon", "bacon lardons", "smoked bacon", "bacon rashers"] },
    { k: "chorizo", d: "Chorizo", p: 650, pack: "1 each", a: [] },
    { k: "ham", d: "Ham", p: 600, pack: "1 pack", a: ["gammon", "prosciutto", "pancetta"] },
    { k: "lamb", d: "Lamb", p: 1600, pack: "~1.5 lb", a: ["lamb mince", "minced lamb", "lamb chops", "leg of lamb", "lamb shoulder", "diced lamb"] },
    { k: "turkey", d: "Turkey", p: 800, pack: "1 lb", a: ["ground turkey", "turkey mince", "turkey breast"] },
    { k: "salmon", d: "Salmon", p: 1600, pack: "2 fillets (~0.75 lb)", a: ["salmon fillet", "salmon fillets", "smoked salmon"] },
    { k: "white fish", d: "White Fish", p: 1300, pack: "2 fillets", a: ["cod", "cod fillet", "haddock", "tilapia", "pollock", "white fish fillets", "sea bass"] },
    { k: "shrimp", d: "Shrimp / Prawns", p: 1300, pack: "1 lb bag", a: ["prawns", "prawn", "king prawns", "tiger prawns", "raw prawns"] },
  ]),

  // ---- Dairy & Eggs ----
  ...group("Dairy & Eggs", false, [
    { k: "eggs", d: "Eggs", p: 450, pack: "1 dozen", a: ["egg", "large eggs", "free range eggs"] },
    { k: "milk", d: "Milk", p: 400, pack: "1/2 gallon", a: ["whole milk", "semi skimmed milk", "skimmed milk"] },
    { k: "butter", d: "Butter", p: 550, pack: "1 lb (4 sticks)", a: ["unsalted butter", "salted butter"] },
    { k: "cheddar", d: "Cheddar Cheese", p: 600, pack: "8 oz block", a: ["cheddar cheese", "grated cheese", "mature cheddar", "cheese"] },
    { k: "parmesan", d: "Parmesan", p: 750, pack: "1 wedge", a: ["parmesan cheese", "parmigiano", "pecorino", "grated parmesan"] },
    { k: "mozzarella", d: "Mozzarella", p: 500, pack: "8 oz", a: ["mozzarella cheese", "fresh mozzarella"] },
    { k: "cream", d: "Cream", p: 400, pack: "1 pint", a: ["heavy cream", "double cream", "whipping cream", "single cream", "heavy whipping cream"] },
    { k: "sour cream", d: "Sour Cream", p: 300, pack: "1 tub", a: ["soured cream", "creme fraiche"] },
    { k: "yogurt", d: "Yogurt", p: 380, pack: "1 tub", a: ["greek yogurt", "natural yogurt", "plain yogurt", "yoghurt", "greek yoghurt"] },
    { k: "cream cheese", d: "Cream Cheese", p: 350, pack: "1 tub", a: ["soft cheese"] },
    { k: "feta", d: "Feta", p: 500, pack: "1 block", a: ["feta cheese"] },
  ]),

  // ---- Bakery ----
  ...group("Bakery", false, [
    { k: "bread", d: "Bread", p: 350, pack: "1 loaf", a: ["bread rolls", "baguette", "ciabatta", "sourdough", "white bread", "crusty bread"] },
    { k: "tortillas", d: "Tortillas", p: 400, pack: "1 pack", a: ["tortilla", "flour tortillas", "tortilla wraps", "wraps", "corn tortillas"] },
    { k: "burger buns", d: "Burger Buns", p: 400, pack: "1 pack", a: ["buns", "brioche buns", "hamburger buns"] },
    { k: "naan", d: "Naan", p: 400, pack: "1 pack", a: ["naan bread"] },
    { k: "pita", d: "Pita", p: 400, pack: "1 pack", a: ["pita bread", "pitta", "pitta bread"] },
  ]),

  // ---- Pantry (non-staple: things you actively shop for) ----
  ...group("Pantry", false, [
    { k: "rice", d: "Rice", p: 600, pack: "2 lb bag", a: ["basmati rice", "long grain rice", "white rice", "jasmine rice", "brown rice", "arborio rice", "long-grain rice"] },
    { k: "pasta", d: "Pasta", p: 250, pack: "1 lb box", a: ["spaghetti", "penne", "fusilli", "macaroni", "tagliatelle", "linguine", "rigatoni", "farfalle", "pasta shells", "lasagne sheets", "lasagna"] },
    { k: "noodles", d: "Noodles", p: 300, pack: "1 pack", a: ["egg noodles", "rice noodles", "udon", "ramen noodles", "vermicelli"] },
    { k: "canned tomatoes", d: "Canned Tomatoes", p: 180, pack: "1 can", a: ["chopped tomatoes", "tinned tomatoes", "plum tomatoes", "crushed tomatoes", "diced tomatoes", "canned chopped tomatoes"] },
    { k: "tomato paste", d: "Tomato Paste", p: 130, pack: "1 can", a: ["tomato puree", "tomato concentrate"] },
    { k: "passata", d: "Passata", p: 250, pack: "1 carton", a: ["sieved tomatoes", "tomato sauce", "tomato passata"] },
    { k: "coconut milk", d: "Coconut Milk", p: 250, pack: "1 can", a: ["coconut cream", "tinned coconut milk"] },
    { k: "chickpeas", d: "Chickpeas", p: 150, pack: "1 can", a: ["garbanzo beans", "canned chickpeas", "chick peas"] },
    { k: "kidney beans", d: "Kidney Beans", p: 150, pack: "1 can", a: ["red kidney beans"] },
    { k: "black beans", d: "Black Beans", p: 150, pack: "1 can", a: [] },
    { k: "white beans", d: "White Beans", p: 150, pack: "1 can", a: ["cannellini beans", "butter beans", "haricot beans"] },
    { k: "lentils", d: "Lentils", p: 300, pack: "1 bag", a: ["red lentils", "green lentils", "puy lentils"] },
    { k: "peanut butter", d: "Peanut Butter", p: 450, pack: "1 jar", a: ["peanut butter smooth"] },
    { k: "breadcrumbs", d: "Breadcrumbs", p: 320, pack: "1 pack", a: ["panko", "panko breadcrumbs", "bread crumbs"] },
    { k: "oats", d: "Oats", p: 450, pack: "1 tub", a: ["rolled oats", "porridge oats"] },
    { k: "curry paste", d: "Curry Paste", p: 450, pack: "1 jar", a: ["red curry paste", "green curry paste", "thai curry paste", "thai red curry paste"] },
    { k: "salsa", d: "Salsa", p: 400, pack: "1 jar", a: ["tomato salsa"] },
    { k: "couscous", d: "Couscous", p: 350, pack: "1 box", a: [] },
    { k: "quinoa", d: "Quinoa", p: 600, pack: "1 bag", a: [] },
    { k: "gnocchi", d: "Gnocchi", p: 350, pack: "1 pack", a: [] },
    { k: "wine", d: "Cooking Wine", p: 1200, pack: "1 bottle", a: ["red wine", "white wine", "dry white wine", "dry red wine"] },
    { k: "nuts", d: "Nuts", p: 700, pack: "1 bag", a: ["almonds", "cashews", "cashew nuts", "peanuts", "walnuts", "pine nuts", "flaked almonds"] },
    { k: "coconut", d: "Desiccated Coconut", p: 300, pack: "1 bag", a: ["desiccated coconut", "shredded coconut"] },
    { k: "raisins", d: "Raisins", p: 350, pack: "1 bag", a: ["sultanas", "currants"] },
  ]),

  // ---- Pantry staples (assumed on hand — excluded from the shop) ----
  ...group("Pantry", true, [
    { k: "olive oil", d: "Olive Oil", p: 700, pack: "1 bottle", a: ["extra virgin olive oil", "evoo"] },
    { k: "vegetable oil", d: "Vegetable Oil", p: 400, pack: "1 bottle", a: ["sunflower oil", "canola oil", "cooking oil", "rapeseed oil"] },
    { k: "sesame oil", d: "Sesame Oil", p: 400, pack: "1 bottle", a: ["toasted sesame oil"] },
    { k: "soy sauce", d: "Soy Sauce", p: 300, pack: "1 bottle", a: ["light soy sauce", "dark soy sauce", "tamari"] },
    { k: "fish sauce", d: "Fish Sauce", p: 300, pack: "1 bottle", a: ["nam pla"] },
    { k: "worcestershire sauce", d: "Worcestershire Sauce", p: 300, pack: "1 bottle", a: ["worcester sauce"] },
    { k: "vinegar", d: "Vinegar", p: 250, pack: "1 bottle", a: ["white wine vinegar", "red wine vinegar", "balsamic vinegar", "rice vinegar", "apple cider vinegar", "white vinegar", "cider vinegar"] },
    { k: "honey", d: "Honey", p: 400, pack: "1 jar", a: ["runny honey"] },
    { k: "mustard", d: "Mustard", p: 300, pack: "1 jar", a: ["dijon mustard", "wholegrain mustard", "english mustard", "dijon"] },
    { k: "ketchup", d: "Ketchup", p: 300, pack: "1 bottle", a: ["tomato ketchup"] },
    { k: "mayonnaise", d: "Mayonnaise", p: 400, pack: "1 jar", a: ["mayo"] },
    { k: "hot sauce", d: "Hot Sauce", p: 300, pack: "1 bottle", a: ["sriracha", "tabasco", "chilli sauce", "chili sauce"] },
    { k: "stock", d: "Stock", p: 250, pack: "1 pack", a: ["chicken stock", "beef stock", "vegetable stock", "stock cube", "stock cubes", "chicken broth", "beef broth", "vegetable broth", "bouillon"] },
    { k: "flour", d: "Flour", p: 300, pack: "1 bag", a: ["plain flour", "all purpose flour", "all-purpose flour", "self raising flour", "self-raising flour", "bread flour"] },
    { k: "sugar", d: "Sugar", p: 250, pack: "1 bag", a: ["caster sugar", "brown sugar", "granulated sugar", "icing sugar", "white sugar", "light brown sugar", "dark brown sugar"] },
    { k: "cornstarch", d: "Cornstarch", p: 200, pack: "1 box", a: ["cornflour", "corn starch", "corn flour"] },
    { k: "baking powder", d: "Baking Powder", p: 200, pack: "1 tub", a: ["baking soda", "bicarbonate of soda", "bicarb"] },
    { k: "vanilla", d: "Vanilla Extract", p: 400, pack: "1 bottle", a: ["vanilla extract", "vanilla essence", "vanilla pod"] },
    { k: "water", d: "Water", p: 0, pack: "tap", a: ["cold water", "boiling water", "warm water"] },
  ]),

  // ---- Spices & Baking (staples assumed on hand) ----
  ...group("Spices & Baking", true, [
    { k: "salt", d: "Salt", p: 200, pack: "1 box", a: ["sea salt", "kosher salt", "table salt", "salt and pepper"] },
    { k: "black pepper", d: "Black Pepper", p: 300, pack: "1 grinder", a: ["pepper", "white pepper", "peppercorns", "ground black pepper", "cracked black pepper"] },
    { k: "paprika", d: "Paprika", p: 250, pack: "1 jar", a: ["smoked paprika", "sweet paprika"] },
    { k: "cumin", d: "Cumin", p: 250, pack: "1 jar", a: ["ground cumin", "cumin seeds"] },
    { k: "ground coriander", d: "Ground Coriander", p: 250, pack: "1 jar", a: ["coriander seeds", "coriander powder"] },
    { k: "chili powder", d: "Chili Powder", p: 250, pack: "1 jar", a: ["chilli powder", "cayenne", "cayenne pepper", "red chilli powder"] },
    { k: "chili flakes", d: "Chili Flakes", p: 250, pack: "1 jar", a: ["red pepper flakes", "chilli flakes", "crushed red pepper", "dried chilli flakes"] },
    { k: "curry powder", d: "Curry Powder", p: 250, pack: "1 jar", a: ["garam masala", "madras curry powder", "mild curry powder"] },
    { k: "turmeric", d: "Turmeric", p: 250, pack: "1 jar", a: ["ground turmeric"] },
    { k: "cinnamon", d: "Cinnamon", p: 250, pack: "1 jar", a: ["ground cinnamon", "cinnamon stick"] },
    { k: "nutmeg", d: "Nutmeg", p: 250, pack: "1 jar", a: ["ground nutmeg"] },
    { k: "ground ginger", d: "Ground Ginger", p: 250, pack: "1 jar", a: [] },
    { k: "oregano", d: "Oregano", p: 250, pack: "1 jar", a: ["dried oregano", "mixed herbs", "italian seasoning", "dried mixed herbs"] },
    { k: "thyme", d: "Thyme", p: 250, pack: "1 jar", a: ["dried thyme", "fresh thyme"] },
    { k: "rosemary", d: "Rosemary", p: 250, pack: "1 jar", a: ["dried rosemary", "fresh rosemary"] },
    { k: "bay leaf", d: "Bay Leaf", p: 250, pack: "1 jar", a: ["bay leaves"] },
    { k: "garlic powder", d: "Garlic Powder", p: 250, pack: "1 jar", a: ["onion powder", "garlic granules"] },
    { k: "allspice", d: "Allspice", p: 250, pack: "1 jar", a: ["mixed spice", "ground allspice"] },
    { k: "cloves", d: "Cloves", p: 250, pack: "1 jar", a: ["ground cloves", "whole cloves"] },
    { k: "cardamom", d: "Cardamom", p: 300, pack: "1 jar", a: ["cardamom pods", "ground cardamom"] },
    { k: "five spice", d: "Five Spice", p: 250, pack: "1 jar", a: ["chinese five spice", "5 spice"] },
    { k: "fennel seeds", d: "Fennel Seeds", p: 250, pack: "1 jar", a: ["mustard seeds", "cumin seed"] },
    { k: "saffron", d: "Saffron", p: 600, pack: "1 jar", a: [] },
    { k: "cocoa", d: "Cocoa Powder", p: 300, pack: "1 tub", a: ["cocoa powder", "cacao"] },
    { k: "yeast", d: "Yeast", p: 200, pack: "1 pack", a: ["dried yeast", "active dry yeast", "fast action yeast"] },
  ]),

  // ---- Frozen ----
  ...group("Frozen", false, [
    { k: "peas", d: "Peas", p: 300, pack: "1 bag", a: ["frozen peas", "garden peas"] },
    { k: "puff pastry", d: "Puff Pastry", p: 500, pack: "1 pack", a: ["pastry", "shortcrust pastry", "filo pastry", "puff pastry sheet"] },
  ]),
];

// ---- Resolver ----

const INDEX = new Map<string, CatalogEntry>();
for (const e of CATALOG) {
  INDEX.set(e.key, e);
  for (const a of e.aliases) if (!INDEX.has(a)) INDEX.set(a, e);
}

const DESCRIPTORS = new Set([
  "fresh", "dried", "ground", "chopped", "minced", "sliced", "diced", "grated",
  "large", "small", "medium", "boneless", "skinless", "whole", "frozen",
  "canned", "tinned", "cooked", "raw", "ripe", "peeled", "crushed", "of", "a",
  "free", "range", "organic", "good", "quality", "finely", "roughly", "extra",
]);

export interface ResolvedIngredient {
  key: string;
  displayName: string;
  aisle: Aisle;
  isStaple: boolean;
  packPriceCents: number;
  packLabel: string;
  matched: boolean; // true when found in the curated catalog (vs. heuristic fallback)
}

export function cleanRawName(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ") // drop parentheticals
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularize(name: string): string {
  return name
    .split(" ")
    .map((w) => {
      if (w.endsWith("ies")) return w.slice(0, -3) + "y";
      if (w.endsWith("oes")) return w.slice(0, -2);
      if (w.endsWith("ss")) return w; // glass, etc.
      if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
      return w;
    })
    .join(" ");
}

function stripDescriptors(name: string): string {
  return name
    .split(" ")
    .filter((w) => !DESCRIPTORS.has(w))
    .join(" ")
    .trim();
}

export function resolveIngredient(raw: string): ResolvedIngredient {
  const cleaned = cleanRawName(raw);
  if (!cleaned) return fallback(raw);

  const candidates = [
    cleaned,
    singularize(cleaned),
    stripDescriptors(cleaned),
    singularize(stripDescriptors(cleaned)),
  ];
  for (const c of candidates) {
    const e = INDEX.get(c);
    if (e) return { ...e, matched: true };
  }
  return fallback(raw, cleaned);
}

function fallback(raw: string, cleaned?: string): ResolvedIngredient {
  const name = cleaned ?? cleanRawName(raw);
  const isStaple = inferStaple(name);
  const aisle = inferAisle(name);
  return {
    key: name || "unknown",
    displayName: titleCase(raw.trim() || name),
    aisle,
    isStaple,
    packPriceCents: isStaple ? 0 : DEFAULT_PRICE[aisle],
    packLabel: "1 each",
    matched: false,
  };
}

const DEFAULT_PRICE: Record<Aisle, number> = {
  Produce: 200,
  "Meat & Seafood": 1200,
  "Dairy & Eggs": 500,
  Bakery: 400,
  Pantry: 350,
  "Spices & Baking": 450,
  Frozen: 400,
  Other: 350,
};

function inferAisle(name: string): Aisle {
  if (/chicken|beef|pork|lamb|sausage|bacon|steak|mince|turkey|\bham\b|jamon|jambon|gammon|prosciutto|pancetta|salami|pepperoni|veal|chorizo|duck|mutton|goat|oxtail|\bribs?\b|poultry|meat/.test(name)) return "Meat & Seafood";
  if (/fish|salmon|tuna|cod|haddock|tilapia|pollock|\bbass\b|prawn|shrimp|seafood|crab|lobster|squid|calamari|octopus|mackerel|sardine|anchov|scallop|mussel|clam|oyster/.test(name)) return "Meat & Seafood";
  if (/cheese|milk|cream|butter|yogurt|yoghurt|\begg/.test(name)) return "Dairy & Eggs";
  if (/lettuce|onion|garlic|tomato|pepper|carrot|potato|spinach|parsley|cilantro|coriander|basil|\bdill\b|tarragon|chive|sage|lemon|lime|cucumber|celery|mushroom|broccoli|cabbage|kale|ginger|chilli|chili|avocado|zucchini|courgette|leek|scallion|herb|fruit|vegetable|salad|rocket|arugula|watercress|chard|beansprout|bean sprout|beetroot|radish|fennel|asparagus|pumpkin|squash|pear|berr/.test(name)) return "Produce";
  if (/bread|\bbun\b|tortilla|naan|pita|pitta|bagel|\broll\b|baguette|pastry|croissant/.test(name)) return "Bakery";
  if (/salt|pepper|spice|paprika|cumin|cinnamon|powder|seeds?\b|oregano|thyme|rosemary|turmeric|nutmeg|flakes|\bbay\b|saffron|masala/.test(name)) return "Spices & Baking";
  if (/frozen/.test(name)) return "Frozen";
  return "Pantry";
}

function inferStaple(name: string): boolean {
  return /salt|\bpepper\b|\boil\b|vinegar|sugar|flour|spice|powder|seeds?\b|paprika|cumin|cinnamon|oregano|thyme|rosemary|turmeric|nutmeg|bay leaf|stock|broth|bouillon|soy sauce|\bwater\b|baking|honey|\bmustard\b|ketchup|yeast|vanilla|extract/.test(name);
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}
