import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserEntitlements } from "@/lib/entitlements";
import { getReferralSummary } from "@/lib/referrals";
import { STRIPE_ENABLED } from "@/lib/stripe";
import { openBillingPortal, devDisablePro } from "@/app/actions/billing";
import { addAddress, deleteAddress, setDefaultAddress } from "@/app/actions/address";

export const metadata = { title: "Your account — Forkcast" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/account");

  const ent = await getUserEntitlements(session.user.id);
  const addresses = ent.cheapestStore
    ? await prisma.address.findMany({
        where: { userId: session.user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      })
    : [];

  // Referral code: new users get one at sign-up (see auth.ts createUser); fall
  // back to a stable id-derived code for accounts created before referrals.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { referralCode: true },
  });
  const referralCode = me?.referralCode ?? session.user.id.slice(-6).toLowerCase();
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/?ref=${referralCode}`;
  const referrals = await getReferralSummary(session.user.id);
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-oat px-5 py-12 text-char">
      <div className="flex items-center justify-between">
        <Link href="/" className="font-display text-xl font-black tracking-tight text-forest">
          Forkcast
        </Link>
        <div className="flex items-center gap-4">
          {ent.weeklyReport && (
            <Link href="/report" className="text-sm font-medium text-muted transition hover:text-forest">
              Weekly report
            </Link>
          )}
          {ent.planHistory && (
            <Link href="/history" className="text-sm font-medium text-muted transition hover:text-forest">
              Plan history
            </Link>
          )}
          <Link href="/app" className="text-sm font-medium text-muted transition hover:text-forest">
            Open the planner →
          </Link>
        </div>
      </div>

      <h1 className="mt-10 font-display text-3xl font-black tracking-tight text-char">Your account</h1>

      <section className="mt-6 rounded-3xl border border-sage-line bg-white p-6 shadow-warm">
        <div className="flex items-center gap-4">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={session.user.image} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sage font-display text-lg font-black text-forest">
              {(session.user.name ?? session.user.email ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="font-semibold text-char">{session.user.name ?? "Forkcaster"}</div>
            <div className="text-sm text-muted">{session.user.email}</div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-sage-line bg-white p-6 shadow-warm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted">Plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-display text-xl font-black tracking-tight text-forest">
                {ent.isPro ? "Pro" : "Free"}
              </span>
              {ent.isPro && (
                <span className="rounded-full bg-basil/10 px-2 py-0.5 text-xs font-semibold text-basil">
                  $5/mo
                </span>
              )}
            </div>
          </div>
          {ent.isPro ? (
            <form action={STRIPE_ENABLED ? openBillingPortal : devDisablePro}>
              <button className="rounded-full border border-sage-line bg-white px-5 py-2.5 text-sm font-semibold text-forest transition hover:bg-sage/40">
                {STRIPE_ENABLED ? "Manage billing" : "Downgrade (dev)"}
              </button>
            </form>
          ) : (
            <Link
              href="/pricing"
              className="rounded-full bg-basil px-5 py-2.5 text-sm font-semibold text-oat transition hover:bg-forest"
            >
              Upgrade to Pro
            </Link>
          )}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {ent.isPro
            ? "Unlimited plans, the cheapest store near you, the weekly email, plan history, and your weekly spend + nutrition report."
            : "Free includes one plan a week with the grocery list and Sunday prep. Pro unlocks unlimited plans, the cheapest store near your address, the weekly email, and a weekly spend + nutrition report."}
        </p>
      </section>

      {ent.cheapestStore && (
        <section className="mt-5 rounded-3xl border border-sage-line bg-white p-6 shadow-warm">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">
            Addresses for the cheapest-store search
          </div>

          {addresses.length > 0 && (
            <ul className="mt-3 space-y-2">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sage-line bg-oat/50 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-char">{a.label}</span>
                      {a.isDefault && (
                        <span className="rounded-full bg-basil/10 px-2 py-0.5 text-[10px] font-semibold text-basil">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {[a.line1, a.city, a.region, a.postalCode].filter(Boolean).join(", ")}
                      {a.lat == null ? " · not located" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!a.isDefault && (
                      <form action={setDefaultAddress}>
                        <input type="hidden" name="id" value={a.id} />
                        <button className="text-xs font-medium text-brand-dark hover:underline">Make default</button>
                      </form>
                    )}
                    <form action={deleteAddress}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs font-medium text-muted transition hover:text-ember">Remove</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form action={addAddress} className="mt-4 grid grid-cols-2 gap-2">
            <input name="label" placeholder="Label (Home)" className="col-span-2 rounded-lg border border-sage-line px-3 py-2 text-sm outline-none focus:border-basil sm:col-span-1" />
            <input name="postalCode" placeholder="ZIP" required className="rounded-lg border border-sage-line px-3 py-2 text-sm outline-none focus:border-basil sm:col-span-1" />
            <input name="line1" placeholder="Street address" required className="col-span-2 rounded-lg border border-sage-line px-3 py-2 text-sm outline-none focus:border-basil" />
            <input name="city" placeholder="City" required className="rounded-lg border border-sage-line px-3 py-2 text-sm outline-none focus:border-basil" />
            <input name="region" placeholder="State" className="rounded-lg border border-sage-line px-3 py-2 text-sm outline-none focus:border-basil" />
            <button className="col-span-2 rounded-xl bg-basil py-2.5 text-sm font-semibold text-oat transition hover:bg-forest">
              Add address
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            Used only to find nearby stores. Real prices where a retailer API is available; modeled estimates elsewhere.
          </p>
        </section>
      )}

      <section className="mt-5 rounded-3xl border border-sage-line bg-white p-6 shadow-warm">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Invite a friend</div>
        <p className="mt-1 text-sm text-muted">
          Share Forkcast — when a friend you invite upgrades to Pro, you both get {money(500)} off.
        </p>
        <div className="mt-2 rounded-lg border border-sage-line bg-oat/50 px-3 py-2 font-mono text-sm text-forest">
          {inviteUrl}
        </div>
        {referrals.joined > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-char">
              <span className="font-semibold text-forest">{referrals.joined}</span>{" "}
              {referrals.joined === 1 ? "friend has" : "friends have"} joined Pro
            </span>
            {referrals.rewardedCents > 0 && (
              <span className="rounded-full bg-basil/10 px-2.5 py-0.5 text-xs font-semibold text-basil">
                {money(referrals.rewardedCents)} earned
              </span>
            )}
            {referrals.pending > 0 && (
              <span className="text-xs text-muted">{money(referrals.pending * 500)} on the way</span>
            )}
          </div>
        )}
      </section>

      <section className="mt-5 flex flex-wrap items-center gap-3">
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="rounded-full border border-sage-line bg-white px-5 py-2.5 text-sm font-semibold text-char transition hover:bg-sage/40">
            Sign out
          </button>
        </form>

        <form
          action={async () => {
            "use server";
            const s = await auth();
            if (s?.user?.id) await prisma.user.delete({ where: { id: s.user.id } });
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="rounded-full px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ember">
            Delete account
          </button>
        </form>
      </section>
    </main>
  );
}
