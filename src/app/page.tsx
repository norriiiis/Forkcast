import Link from "next/link";
import Reveal from "@/components/landing/Reveal";
import WaitlistForm from "@/components/landing/WaitlistForm";
import CountUp from "@/components/landing/CountUp";
import TiltCard from "@/components/landing/TiltCard";
import Parallax from "@/components/landing/Parallax";
import ScrollProgress from "@/components/landing/ScrollProgress";
import OverlapDiagram from "@/components/landing/OverlapDiagram";

/* ------------------------------------------------------------------ *
 * An honest, representative week — the kind of plan Forkcast builds:
 * five dinners that share ingredients, one aisle-sorted list, one prep.
 * The live engine generates a real plan for the visitor's own kitchen
 * one click away at /demo; this page shows the shape of the payoff.
 * ------------------------------------------------------------------ */

type Meal = { title: string; protein: string; area: string | null; shared: string[] };
type AisleItem = { name: string; note: string; price: string; shared: boolean; usedBy: number };
type Aisle = { aisle: string; items: AisleItem[]; subtotal: string };
type PrepBlock = { label: string; minutes: number; tasks: string[] };

type Week = {
  nights: number;
  servings: number;
  distinct: number;
  meals: Meal[];
  aisles: Aisle[];
  prep: PrepBlock[];
  staples: string[];
  total: string;
  perServing: string;
  savings: string;
  prepMinutes: number;
  topShared: { name: string; count: number } | null;
};

const WEEK: Week = {
  nights: 5,
  servings: 2,
  distinct: 16,
  total: "$51.81",
  perServing: "$5.18",
  savings: "$22.60",
  prepMinutes: 90,
  topShared: { name: "Chicken thighs", count: 3 },
  meals: [
    { title: "Honey-Garlic Chicken Thighs", protein: "Chicken", area: "American", shared: ["Onion", "Garlic", "Rice"] },
    { title: "Chicken Fajita Bowls", protein: "Chicken", area: "Mexican", shared: ["Chicken thighs", "Onion", "Bell pepper"] },
    { title: "Tuscan Chicken Pasta", protein: "Chicken", area: "Italian", shared: ["Chicken thighs", "Onion", "Spinach"] },
    { title: "Sausage & Pepper Skillet", protein: "Pork", area: "Italian", shared: ["Onion", "Bell pepper", "Cherry tomatoes"] },
    { title: "Chickpea Coconut Curry", protein: "Vegetarian", area: "Indian", shared: ["Onion", "Garlic", "Spinach"] },
  ],
  aisles: [
    {
      aisle: "Meat & Seafood",
      subtotal: "$19.46",
      items: [
        { name: "Chicken thighs", note: "3 × 1 lb", price: "$14.97", shared: true, usedBy: 3 },
        { name: "Italian sausage", note: "1 lb", price: "$4.49", shared: false, usedBy: 1 },
      ],
    },
    {
      aisle: "Produce",
      subtotal: "$13.94",
      items: [
        { name: "Yellow onion", note: "1 bag", price: "$2.49", shared: true, usedBy: 5 },
        { name: "Bell peppers", note: "3 ct", price: "$3.99", shared: true, usedBy: 2 },
        { name: "Cherry tomatoes", note: "1 pint", price: "$2.99", shared: true, usedBy: 2 },
        { name: "Baby spinach", note: "1 bag", price: "$2.99", shared: true, usedBy: 2 },
        { name: "Garlic", note: "1 bulb", price: "$0.79", shared: true, usedBy: 3 },
        { name: "Lemon", note: "1 ct", price: "$0.69", shared: false, usedBy: 1 },
      ],
    },
    {
      aisle: "Pantry",
      subtotal: "$12.95",
      items: [
        { name: "Jasmine rice", note: "1 bag", price: "$3.99", shared: true, usedBy: 2 },
        { name: "Penne pasta", note: "1 box", price: "$1.99", shared: false, usedBy: 1 },
        { name: "Chickpeas", note: "1 can", price: "$0.99", shared: false, usedBy: 1 },
        { name: "Coconut milk", note: "1 can", price: "$1.99", shared: false, usedBy: 1 },
        { name: "Diced tomatoes", note: "1 can", price: "$1.49", shared: false, usedBy: 1 },
        { name: "Chicken stock", note: "1 carton", price: "$2.50", shared: false, usedBy: 1 },
      ],
    },
    {
      aisle: "Dairy & Eggs",
      subtotal: "$5.46",
      items: [
        { name: "Heavy cream", note: "1 pint", price: "$2.99", shared: false, usedBy: 1 },
        { name: "Greek yogurt", note: "1 tub", price: "$2.47", shared: false, usedBy: 1 },
      ],
    },
  ],
  prep: [
    { label: "Mise en place", minutes: 15, tasks: ["Wash and chop the shared produce — onion, garlic, peppers, spinach — and store it grab-and-go."] },
    { label: "Batch-cook proteins", minutes: 30, tasks: ["Cook the chicken thighs and sausage in batches; cool and store, ready to flavor per recipe."] },
    { label: "Cook bases & sauces", minutes: 30, tasks: ["Cook the jasmine rice and penne; build the curry and tomato sauce bases."] },
    { label: "Portion & store", minutes: 15, tasks: ["Portion everything into containers, labeled by night. Weeknights are now ~10-minute assembly."] },
  ],
  staples: ["Olive oil", "Salt", "Black pepper", "Honey", "Cumin"],
};

export default function Home() {
  const week = WEEK;
  return (
    <div className="relative min-h-screen overflow-x-clip bg-oat text-char">
      <ScrollProgress />
      <Nav />
      <main>
        <Hero week={week} />
        <Pain />
        <How week={week} />
        <Overlap week={week} />
        <ProofWeek week={week} />
        <CostMath week={week} />
        <Soul />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}

/* ============================== Nav ============================== */

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-sage-line/60 bg-oat/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Forkcast home">
          <Mark className="h-7 w-7" animate />
          <span className="font-display text-[1.35rem] font-black leading-none tracking-tight text-forest">
            Forkcast
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="#how" className="transition hover:text-forest">How it works</a>
          <a href="#week" className="transition hover:text-forest">See a week</a>
          <a href="#math" className="transition hover:text-forest">The math</a>
          <a href="#waitlist" className="transition hover:text-forest">Get updates</a>
          <Link href="/login" className="transition hover:text-forest">Sign in</Link>
        </nav>

        <Link
          href="/demo"
          className="sheen rounded-full bg-basil px-4 py-2 text-sm font-semibold text-oat shadow-sm transition hover:bg-forest"
        >
          Plan my week
        </Link>
      </div>
    </header>
  );
}

/* ============================== Hero ============================== */

function Hero({ week }: { week: Week }) {
  return (
    <section className="grain relative overflow-hidden">
      {/* warm light, drifting like sun moving across a kitchen */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="aurora absolute -right-32 -top-40 h-[36rem] w-[36rem] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(234,88,12,0.14), rgba(21,128,61,0.05) 50%, transparent 72%)" }}
        />
        <div
          className="aurora aurora-slow absolute -left-40 top-24 h-[32rem] w-[32rem] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(21,128,61,0.12), transparent 70%)" }}
        />
        <div
          className="aurora absolute bottom-[-10rem] right-1/4 h-[28rem] w-[28rem] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(232,238,228,0.6), transparent 70%)", animationDelay: "-8s" }}
        />
      </div>
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-28">
        <div>
          <Reveal variant="up">
            <span className="inline-flex items-center gap-2 rounded-full border border-sage-line bg-sage/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-basil">
              <span className="h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
              Meal planning, minus the planning
            </span>
          </Reveal>

          <Reveal variant="up" delay={60}>
            <h1 className="mt-6 font-display text-[2.75rem] font-black leading-[1.02] tracking-[-0.02em] text-char sm:text-6xl">
              Come home to dinner that&apos;s{" "}
              <span className="italic text-basil">already decided.</span>
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              Forkcast picks a week of dinners that quietly share ingredients, then hands you{" "}
              <span className="font-medium text-char">one aisle-sorted grocery list with the price up front</span>{" "}
              and a 90-minute Sunday prep plan. You keep the veto. We&apos;ll handle the rest.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/demo"
                className="sheen group inline-flex items-center justify-center gap-2 rounded-full bg-basil px-6 py-3.5 text-base font-semibold text-oat shadow-warm transition hover:-translate-y-0.5 hover:bg-forest"
              >
                Plan my week — free
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
              </Link>
              <a
                href="#week"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-sage-line bg-oat px-6 py-3.5 text-base font-semibold text-forest transition hover:-translate-y-0.5 hover:bg-sage/50"
              >
                See a whole week
              </a>
            </div>
          </Reveal>

          <Reveal delay={240}>
            <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span className="font-semibold text-forest tnum">~{week.perServing} a plate</span>
              <Dot />
              one grocery run
              <Dot />
              no subscription box
            </p>
          </Reveal>
        </div>

        <Reveal variant="scale" delay={140} className="lg:justify-self-end">
          <Parallax speed={0.06}>
            <HeroArtifact week={week} />
          </Parallax>
        </Reveal>
      </div>
    </section>
  );
}

// Ingredient tokens that drift around the plan card — the "shared ingredients"
// idea, made tactile. Positioned at the card's corners; hidden on small screens.
const TOKENS = [
  { label: "chicken", className: "-left-10 top-12", r: "-8deg", delay: "0s" },
  { label: "onion", className: "-right-8 top-4", r: "7deg", delay: "-1.4s" },
  { label: "garlic", className: "-left-6 bottom-24", r: "6deg", delay: "-2.6s" },
  { label: "rice", className: "-right-10 bottom-16", r: "-6deg", delay: "-3.8s" },
];

function HeroArtifact({ week }: { week: Week }) {
  const perPlate = Number(week.perServing.replace(/[^0-9.]/g, ""));
  const save = Number(week.savings.replace(/[^0-9.]/g, ""));
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {TOKENS.map((t) => (
        <span
          key={t.label}
          aria-hidden
          className={`bob pointer-events-none absolute z-20 hidden rounded-full border border-sage-line bg-white/90 px-3 py-1 text-xs font-medium text-forest shadow-warm backdrop-blur sm:block ${t.className}`}
          style={{ ["--r" as string]: t.r, animationDelay: t.delay }}
        >
          {t.label}
        </span>
      ))}

      <TiltCard className="relative z-10 rounded-[1.75rem] border border-sage-line bg-white p-6 shadow-warm-lg">
        {/* a little "you save" sticker on the corner */}
        <div className="tilt-pop absolute -left-4 -top-4 rotate-[-7deg] rounded-2xl bg-forest px-3.5 py-2 text-oat shadow-warm">
          <div className="text-[0.55rem] font-semibold uppercase tracking-wider text-forest-sage">You save</div>
          <div className="font-display text-lg font-black leading-none tnum">
            <CountUp value={save} prefix="$" decimals={2} />
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">This week</div>
            <div className="font-display text-2xl font-black tracking-tight text-forest">
              {week.nights} dinners
            </div>
          </div>
          <div className="rounded-full bg-sage px-2.5 py-1 text-xs font-medium text-forest">
            serves {week.servings}
          </div>
        </div>

        <ul className="mt-5 space-y-2.5">
          {week.meals.map((m) => (
            <li key={m.title} className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-basil" aria-hidden />
              <span className="truncate text-sm font-medium text-char">{m.title}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-end justify-between border-t border-sage-line pt-4">
          <div className="text-sm text-muted">
            One list,
            <br />
            sorted by aisle
          </div>
          <div className="text-right">
            <div className="font-display text-3xl font-black leading-none tnum text-ember">
              <CountUp value={perPlate} prefix="$" decimals={2} />
            </div>
            <div className="mt-1 text-xs text-muted tnum">
              = {week.total} for the week
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[0.7rem]">
          <Check>Priced before you shop</Check>
          <Check>~{week.prepMinutes}-min Sunday prep</Check>
        </div>
      </TiltCard>
    </div>
  );
}

/* ============================== Pain ============================== */

function Pain() {
  return (
    <section className="border-y border-sage-line/70 bg-oat-deep/60">
      <div className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-24">
        <Reveal>
          <h2 className="font-display text-4xl font-black leading-tight tracking-tight text-char sm:text-5xl">
            It was never the cooking.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted">
            It&apos;s the deciding. Fourteen dinner decisions a week — all at 6&nbsp;p.m., all on you,
            all when you&apos;ve got nothing left. That&apos;s the chore. So that&apos;s the part we took.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== How ============================== */

function How({ week }: { week: Week }) {
  const overlap = week.topShared
    ? `One pack of ${week.topShared.name.toLowerCase()} → ${week.topShared.count} dinners`
    : "One pack of chicken → 3 dinners";

  const steps = [
    {
      icon: <IconOverlap />,
      title: "It finds the overlap.",
      body: "The engine chooses dinners that quietly reuse the same ingredients — so one pack stretches across the whole week instead of rotting in the drawer.",
      chip: overlap,
    },
    {
      icon: <IconList />,
      title: "One list, sorted by aisle.",
      body: "Everything you need on a single grocery run, grouped the way the store is laid out — with the total shown before you ever check out.",
      chip: `${week.distinct} items · ${week.total}`,
    },
    {
      icon: <IconTimer />,
      title: "Ninety minutes, once.",
      body: "A Sunday prep plan that batches the shared parts — proteins, bases, sauces — so weeknight “cooking” is really just ten minutes of assembly.",
      chip: `~${week.prepMinutes} min Sunday · ~10 min nights`,
    },
    {
      icon: <IconPin />,
      title: "The cheapest store near you.",
      body: "Set your location once. Forkcast prices your exact haul at every grocery store within 15 miles and points you to the one that rings up cheapest.",
      chip: `Compared within 15 miles`,
    },
  ];

  return (
    <section id="how" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-basil">How it works</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight tracking-tight text-char sm:text-5xl">
            Four things show up. Every week.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.title} variant="up" delay={i * 110}>
              <div className="lift group flex h-full flex-col rounded-3xl border border-sage-line bg-white p-7 shadow-warm hover:shadow-warm-lg">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sage text-basil transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                  {s.icon}
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-forest">
                  {s.title}
                </h3>
                <p className="mt-2.5 flex-1 text-sm leading-relaxed text-muted">{s.body}</p>
                <div className="mt-5 inline-flex w-fit items-center rounded-lg bg-basil/8 px-3 py-1.5 text-xs font-semibold text-forest tnum">
                  {s.chip}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================== Overlap ============================== */

function Overlap({ week }: { week: Week }) {
  const hero = week.topShared?.name ?? "chicken thighs";
  return (
    <section className="grain relative overflow-hidden bg-forest text-oat">
      <div
        aria-hidden
        className="aurora pointer-events-none absolute -right-20 top-1/2 h-[30rem] w-[30rem] -translate-y-1/2 rounded-full opacity-50 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(31,157,78,0.5), transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:py-28 lg:grid-cols-[0.85fr_1.15fr]">
        <Reveal variant="left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">The whole trick</p>
          <h2 className="mt-3 font-display text-4xl font-black leading-tight tracking-tight text-oat sm:text-5xl">
            One pack. <span className="italic text-basil-bright">Three dinners.</span>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-forest-sage">
            The secret to a cheap week isn&apos;t more recipes — it&apos;s overlap. Forkcast builds the
            week around ingredients that show up again and again, so a single {hero.toLowerCase()} pack
            quietly becomes three different dinners instead of three separate shops.
          </p>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-oat">
            <span className="h-2 w-2 rounded-full bg-ember" aria-hidden />
            Fewer ingredients · less waste · lower bill
          </p>
        </Reveal>

        <Reveal variant="right" delay={120}>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <OverlapDiagram
              ingredientTop="1 pack"
              ingredientBottom={hero.toLowerCase()}
              meals={week.meals.filter((m) => m.protein === "Chicken").map((m) => m.title)}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ========================== Proof: a week ========================== */

function ProofWeek({ week }: { week: Week }) {
  return (
    <section id="week" className="scroll-mt-20 border-y border-sage-line/70 bg-oat-deep/50">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-basil">
            A whole week, start to finish
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight tracking-tight text-char sm:text-5xl">
            Here&apos;s the kind of week it makes.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
            {week.nights} overlapping dinners, one list, one prep — the whole payoff on one screen.
            Open the planner and the numbers update to your kitchen.
          </p>
        </Reveal>

        {/* The plan — full width filmstrip of the week */}
        <Reveal className="mt-12 block">
          <div className="rounded-3xl border border-sage-line bg-white p-6 shadow-warm sm:p-7">
            <Heading label="The plan" hint={`${week.nights} dinners`} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {week.meals.map((m) => (
                <div key={m.title} className="rounded-2xl border border-sage-line bg-oat/60 p-4">
                  <h4 className="font-display text-base font-bold leading-snug tracking-tight text-forest">
                    {m.title}
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Tag>{m.protein}</Tag>
                    {m.area && <Tag muted>{m.area}</Tag>}
                  </div>
                  {m.shared.length > 0 && (
                    <p className="mt-2.5 text-xs text-muted">
                      <span className="font-medium text-basil">Shares</span> {m.shared.join(", ")}
                    </p>
                  )}
                </div>
              ))}
              {/* a closing note that fills the last cell and reinforces the value */}
              <div className="flex flex-col justify-center rounded-2xl border border-dashed border-basil/30 bg-basil/5 p-4">
                <p className="text-sm font-medium leading-snug text-forest">
                  Don&apos;t like one? Swap it.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  The list and prep recalculate around your choice.
                </p>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* The grocery list */}
          <Reveal delay={80}>
            <div className="h-full rounded-3xl border border-sage-line bg-white p-6 shadow-warm sm:p-7">
              <Heading label="One grocery list" hint={`${week.distinct} items`} />
              <div className="mt-4 space-y-4">
                {week.aisles.map((a) => (
                  <div key={a.aisle}>
                    <div className="flex items-center justify-between">
                      <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-muted">
                        {a.aisle}
                      </span>
                      <span className="text-xs text-muted tnum">{a.subtotal}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {a.items.map((i) => (
                        <li key={i.name} className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-char">{i.name}</span>
                            {i.shared && (
                              <span className="shrink-0 rounded-full bg-basil/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-basil tnum">
                                in {i.usedBy}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-muted tnum">{i.price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-end justify-between border-t border-sage-line pt-4">
                <span className="text-sm font-medium text-char">Estimated total</span>
                <span className="font-display text-2xl font-black tnum text-forest">{week.total}</span>
              </div>
            </div>
          </Reveal>

          {/* The prep */}
          <Reveal delay={140}>
            <div className="rounded-3xl border border-sage-line bg-white p-6 shadow-warm sm:p-7">
              <Heading label="Sunday prep" hint={`~${week.prepMinutes} min, once`} />
              <ol className="mt-4 space-y-3.5">
                {week.prep.map((b, idx) => (
                  <li key={b.label} className="flex gap-3.5">
                    <div className="flex w-12 shrink-0 flex-col items-center">
                      <span className="rounded-full bg-basil/10 px-2 py-0.5 text-xs font-semibold text-forest tnum">
                        {b.minutes}m
                      </span>
                      {idx < week.prep.length - 1 && <span className="mt-1 w-px flex-1 bg-sage-line" />}
                    </div>
                    <div className="pb-0.5">
                      <h4 className="text-sm font-semibold text-char">{b.label}</h4>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{b.tasks[0]}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
            <Link
              href="/demo"
              className="sheen group inline-flex items-center gap-2 rounded-full bg-basil px-6 py-3.5 text-base font-semibold text-oat shadow-warm transition hover:-translate-y-0.5 hover:bg-forest"
            >
              Make your own week
              <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
            </Link>
            <span className="text-sm text-muted">Free. No account needed.</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== Math ============================== */

function CostMath({ week }: { week: Week }) {
  const perPlate = Number(week.perServing.replace(/[^0-9.]/g, ""));
  return (
    <section id="math" className="grain relative scroll-mt-20 overflow-hidden bg-forest text-oat">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(234,88,12,0.18), transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-5xl px-5 py-20 sm:py-28">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember">The math</p>
          <h2 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight tracking-tight text-oat sm:text-5xl">
            Meal kits solved dinner. For about twelve dollars a plate.
          </h2>
        </Reveal>

        <div className="mt-12 grid items-stretch gap-8 sm:grid-cols-2">
          <Reveal variant="up">
            <div className="h-full rounded-3xl border border-white/10 bg-white/[0.04] p-8">
              <div className="text-sm font-medium text-forest-sage">A meal kit, per plate</div>
              <div className="mt-2 font-display text-5xl font-black text-forest-sage tnum">
                <CountUp value={12} prefix="~$" decimals={0} />
              </div>
              <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="grow-bar h-full rounded-full bg-forest-sage" style={{ width: "100%" }} />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-forest-sage">
                Boxes, ice packs, shipping, and a subscription that piles up by the door.
              </p>
            </div>
          </Reveal>

          <Reveal variant="up" delay={120}>
            <div className="relative h-full overflow-hidden rounded-3xl border border-ember/30 bg-ember/[0.08] p-8">
              <div className="text-sm font-medium text-oat">Forkcast, per plate</div>
              <div className="mt-2 font-display text-6xl font-black text-ember tnum">
                <CountUp value={perPlate} prefix="~$" decimals={2} />
              </div>
              <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="grow-bar h-full rounded-full bg-ember"
                  style={{ width: `${Math.round((perPlate / 12) * 100)}%`, transitionDelay: "120ms" }}
                />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-oat/90">
                The same solved dinner — at your own store, at grocery prices. Software, not shipping.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <p className="mt-10 max-w-2xl text-lg leading-relaxed text-oat/90">
            No cardboard. No ice packs. No box to cancel. Just the deciding part, done — and the savings
            stay with you. <span className="font-semibold text-oat">That&apos;s the whole difference.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ============================== Soul ============================== */

function Soul() {
  const values = [
    { title: "It decides. You keep the veto.", body: "Don't like a meal? Swap it, and the list and the prep recalculate around your choice." },
    { title: "Easy, fast, cheap, good.", body: "No guilt, no macros, no “clean eating.” We removed a chore — we didn't add a diet." },
    { title: "Your store, your savings.", body: "Software, not boxes. You shop the prices you already pay, and pocket the difference." },
    { title: "One good answer.", body: "Not ten thousand recipes at the exact moment you can't make one more decision. Just dinner, handled." },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
      <Reveal>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-basil">Why it feels different</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-black leading-tight tracking-tight text-char sm:text-5xl">
          Built for a tired Tuesday. <span className="italic text-basil">Not a perfect one.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2">
        {values.map((v, i) => (
          <Reveal key={v.title} variant={i % 2 === 0 ? "left" : "right"} delay={(i % 2) * 80}>
            <div className="group flex gap-4 border-t border-sage-line pt-6">
              <Mark className="mt-1 h-6 w-6 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-forest">{v.title}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-muted">{v.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ============================== Final CTA ============================== */

function FinalCTA() {
  return (
    <section id="waitlist" className="scroll-mt-20 px-5 pb-24 pt-4">
      <div className="grain relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-forest px-6 py-16 text-center shadow-warm-lg sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(234,88,12,0.16), transparent 70%)" }}
        />
        <div className="relative">
          <Reveal>
            <Mark className="mx-auto h-10 w-10" />
            <h2 className="mt-6 font-display text-4xl font-black leading-tight tracking-tight text-oat sm:text-5xl">
              Plan once. Eat all week.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-forest-sage">
              Try the live planner now, or leave your email and we&apos;ll bring you in when the full app
              lands — your first week&apos;s on us.
            </p>
          </Reveal>

          <Reveal delay={90}>
            <div className="mt-8 flex justify-center">
              <Link
                href="/demo"
                className="sheen group inline-flex items-center gap-2 rounded-full bg-oat px-7 py-3.5 text-base font-semibold text-forest shadow-warm transition hover:-translate-y-0.5 hover:bg-white"
              >
                Plan my week now
                <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
              </Link>
            </div>
          </Reveal>

          <Reveal delay={150}>
            <div className="mx-auto mt-10 max-w-md">
              <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-forest-sage">
                <span className="h-px flex-1 bg-white/15" />
                or be first at launch
                <span className="h-px flex-1 bg-white/15" />
              </div>
              <div className="mt-5">
                <WaitlistForm tone="dark" source="cta" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ============================== Footer ============================== */

function Footer() {
  return (
    <footer className="border-t border-sage-line bg-oat-deep/60">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <Link href="/" className="flex items-center gap-2.5" aria-label="Forkcast home">
              <Mark className="h-7 w-7" />
              <span className="font-display text-xl font-black tracking-tight text-forest">Forkcast</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              The cheap, opinionated meal planner that gives one good answer instead of an endless library.
              Plan once. Eat all week.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <a href="#how" className="text-muted transition hover:text-forest">How it works</a>
            <a href="#week" className="text-muted transition hover:text-forest">See a week</a>
            <a href="#math" className="text-muted transition hover:text-forest">The math</a>
            <Link href="/demo" className="text-muted transition hover:text-forest">Try the demo</Link>
            <a href="#waitlist" className="font-medium text-basil transition hover:text-forest">Get launch updates</a>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-sage-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl leading-relaxed">
            A working prototype — recipes from TheMealDB, normalized into Forkcast&apos;s own ingredient
            catalog. Prices are estimates.
          </p>
          <p className="shrink-0">© 2026 Forkcast · @forkcast</p>
        </div>
      </div>
    </footer>
  );
}

/* ============================== Atoms ============================== */

// The fork-forecast mark: four tines stepping up like a forecast chart, the
// tallest tipped with an ember "peak." Pass `animate` to make the tines rise on
// arrival (respects prefers-reduced-motion via globals.css).
function Mark({ className, animate }: { className?: string; animate?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`${className ?? ""} ${animate ? "animate-mark" : ""} text-basil`}
      role="img"
      aria-label="Forkcast"
    >
      <g fill="currentColor">
        <rect className="tine" x="12" y="26" width="7" height="12" rx="3.5" />
        <rect className="tine" x="23" y="20" width="7" height="18" rx="3.5" />
        <rect className="tine" x="34" y="14" width="7" height="24" rx="3.5" />
        <rect className="tine" x="45" y="8" width="7" height="30" rx="3.5" />
        <rect x="11" y="35" width="42" height="7" rx="3.5" />
        <rect x="28" y="40" width="8" height="18" rx="4" />
      </g>
      <circle cx="48.5" cy="8" r="3.4" className="fill-ember" />
    </svg>
  );
}

function Dot() {
  return <span className="h-1 w-1 rounded-full bg-muted/50" aria-hidden />;
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sage px-2.5 py-1 font-medium text-forest">
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
        <path d="M3 8.5l3 3 7-7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {children}
    </span>
  );
}

function Heading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h3 className="font-display text-lg font-bold tracking-tight text-forest">{label}</h3>
      {hint && <span className="text-xs text-muted tnum">{hint}</span>}
    </div>
  );
}

function Tag({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${
        muted ? "bg-sage text-muted" : "bg-basil/10 text-forest"
      }`}
    >
      {children}
    </span>
  );
}

/* ---- line icons (basil, stroke-based) ---- */

function IconOverlap() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <path d="M8 7h10M8 12h10M8 17h7" />
      <path d="M4 7h.01M4 12h.01M4 17h.01" />
    </svg>
  );
}

function IconTimer() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 13V9M9 2h6" />
    </svg>
  );
}

function IconPin() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s-6.5-5.2-6.5-10A6.5 6.5 0 0 1 18.5 11c0 4.8-6.5 10-6.5 10Z" />
      <circle cx="12" cy="11" r="2.4" />
    </svg>
  );
}
