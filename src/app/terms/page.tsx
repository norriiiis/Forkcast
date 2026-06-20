import Link from "next/link";

export const metadata = { title: "Terms of Service — Forkcast" };

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-oat px-5 py-12 text-char">
      <Link href="/" className="font-display text-xl font-black tracking-tight text-forest">Forkcast</Link>
      <h1 className="mt-8 font-display text-3xl font-black tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: June 2026 · Template — have counsel review before launch.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-stone-700">
        <section>
          <h2 className="font-display text-lg font-bold text-forest">1. The service</h2>
          <p className="mt-1">Forkcast generates weekly meal plans, grocery lists, prep schedules, and store cost comparisons. Recipes derive from public data (TheMealDB) normalized into our own catalog. Prices and store comparisons are estimates and may differ from in-store prices.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">2. Accounts</h2>
          <p className="mt-1">You are responsible for activity under your account. Keep your credentials secure. You may delete your account at any time from your account page.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">3. Subscriptions &amp; billing</h2>
          <p className="mt-1">Pro is billed monthly via Stripe. You can cancel anytime; access continues through the paid period. Fees are non-refundable except where required by law.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">4. Acceptable use</h2>
          <p className="mt-1">Don&apos;t misuse the service, scrape it, or attempt to disrupt it. We may suspend accounts that do.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">5. Disclaimers</h2>
          <p className="mt-1">Forkcast is provided &quot;as is.&quot; Nutrition, allergen, and price information is not guaranteed — always check labels and verify prices in store.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">6. Contact</h2>
          <p className="mt-1">Questions? hello@forkcast.app</p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/privacy" className="text-brand-dark underline">Privacy Policy</Link>
      </p>
    </main>
  );
}
