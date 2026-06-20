import Link from "next/link";
import { auth } from "@/auth";
import { getUserEntitlements } from "@/lib/entitlements";
import { STRIPE_ENABLED } from "@/lib/stripe";
import { startCheckout, openBillingPortal, devEnablePro, devDisablePro } from "@/app/actions/billing";

export const metadata = { title: "Pricing — Forkcast" };

const FREE_FEATURES = [
  "One plan a week",
  "Aisle-sorted grocery list with the price up front",
  "90-minute Sunday prep schedule",
  "Modeled store cost estimate",
];
const PRO_FEATURES = [
  "Unlimited plans + swap any meal",
  "The cheapest store near your address (real prices where available)",
  "Your weekly plan, emailed every week",
  "Plan history + multiple saved addresses",
];

export default async function PricingPage() {
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const ent = session?.user?.id ? await getUserEntitlements(session.user.id) : null;
  const isPro = ent?.isPro ?? false;

  return (
    <main className="grain relative min-h-screen bg-oat px-5 py-12 text-char">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="font-display text-xl font-black tracking-tight text-forest">Forkcast</Link>
        <Link href={signedIn ? "/account" : "/login"} className="text-sm font-medium text-muted transition hover:text-forest">
          {signedIn ? "Account" : "Sign in"}
        </Link>
      </header>

      <div className="mx-auto mt-12 max-w-2xl text-center">
        <h1 className="font-display text-4xl font-black leading-tight tracking-tight text-char sm:text-5xl">
          One good answer, <span className="italic text-basil">for the price of a coffee.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-muted">
          Start free. Upgrade when you want the cheapest store near you and a plan that shows up every week.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-2">
        {/* Free */}
        <div className="flex flex-col rounded-3xl border border-sage-line bg-white p-7 shadow-warm">
          <div className="text-sm font-semibold uppercase tracking-wide text-muted">Free</div>
          <div className="mt-2 font-display text-4xl font-black tracking-tight text-forest">$0</div>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-char">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5"><span className="text-basil">✓</span>{f}</li>
            ))}
          </ul>
          <div className="mt-7">
            {!signedIn ? (
              <Link href="/login" className="block rounded-full border border-sage-line bg-white py-3 text-center text-sm font-semibold text-forest transition hover:bg-sage/40">
                Get started free
              </Link>
            ) : (
              <Link href="/app" className="block rounded-full border border-sage-line bg-white py-3 text-center text-sm font-semibold text-forest transition hover:bg-sage/40">
                {isPro ? "Open the planner" : "Your current plan"}
              </Link>
            )}
          </div>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-3xl border-2 border-basil bg-white p-7 shadow-warm-lg">
          <div className="absolute -top-3 left-7 rounded-full bg-basil px-3 py-1 text-xs font-semibold text-oat">Most popular</div>
          <div className="text-sm font-semibold uppercase tracking-wide text-basil">Pro</div>
          <div className="mt-2 font-display text-4xl font-black tracking-tight text-forest">
            $5<span className="text-lg font-bold text-muted">/mo</span>
          </div>
          <ul className="mt-6 flex-1 space-y-3 text-sm text-char">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5"><span className="text-basil">✓</span>{f}</li>
            ))}
          </ul>
          <div className="mt-7">
            {!signedIn ? (
              <Link href="/login?callbackUrl=/pricing" className="block rounded-full bg-basil py-3 text-center text-sm font-semibold text-oat transition hover:bg-forest">
                Start Pro
              </Link>
            ) : isPro ? (
              <form action={STRIPE_ENABLED ? openBillingPortal : devDisablePro}>
                <button className="w-full rounded-full border border-sage-line bg-white py-3 text-sm font-semibold text-forest transition hover:bg-sage/40">
                  {STRIPE_ENABLED ? "Manage billing" : "Downgrade (dev)"}
                </button>
              </form>
            ) : (
              <form action={STRIPE_ENABLED ? startCheckout : devEnablePro}>
                <button className="w-full rounded-full bg-basil py-3 text-sm font-semibold text-oat transition hover:bg-forest">
                  {STRIPE_ENABLED ? "Upgrade to Pro — $5/mo" : "Simulate Pro (dev)"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {!STRIPE_ENABLED && (
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs text-muted">
          Stripe keys aren&apos;t configured, so the Pro button simulates the upgrade locally. Add
          <code className="mx-1 rounded bg-sage px-1.5 py-0.5">STRIPE_SECRET_KEY</code> to run real Checkout.
        </p>
      )}
    </main>
  );
}
