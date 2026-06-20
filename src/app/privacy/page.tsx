import Link from "next/link";

export const metadata = { title: "Privacy Policy — Forkcast" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-oat px-5 py-12 text-char">
      <Link href="/" className="font-display text-xl font-black tracking-tight text-forest">Forkcast</Link>
      <h1 className="mt-8 font-display text-3xl font-black tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: June 2026 · Template — have counsel review before launch.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-stone-700">
        <section>
          <h2 className="font-display text-lg font-bold text-forest">What we collect</h2>
          <p className="mt-1">Your email and name (for your account), your saved <strong>addresses</strong> (to find nearby stores — used only for that purpose), your meal preferences and generated plans, and billing identifiers managed by Stripe. We never see or store your full card details.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">How we use it</h2>
          <p className="mt-1">To generate your plans, find the cheapest nearby store, send the emails you opt into, and operate billing. We use privacy-respecting analytics to improve the product.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">Sharing</h2>
          <p className="mt-1">We share only with processors that run the service: Stripe (billing), Resend (email), our hosting and database providers, and mapping/grocery APIs (your approximate location, to find stores). We don&apos;t sell your data.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">Your choices</h2>
          <p className="mt-1">You can edit or remove addresses, unsubscribe from emails, and delete your account (which removes your data) at any time from your account page.</p>
        </section>
        <section>
          <h2 className="font-display text-lg font-bold text-forest">Contact</h2>
          <p className="mt-1">privacy@forkcast.app</p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/terms" className="text-brand-dark underline">Terms of Service</Link>
      </p>
    </main>
  );
}
