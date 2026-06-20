import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn, AUTH_PROVIDERS } from "@/auth";

export const metadata = { title: "Sign in — Forkcast" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/app";
  if (session?.user) redirect(redirectTo);

  return (
    <main className="grain relative flex min-h-screen flex-col items-center justify-center bg-oat px-5 py-16 text-char">
      <Link href="/" className="font-display text-2xl font-black tracking-tight text-forest">
        Forkcast
      </Link>
      <div className="mt-8 w-full max-w-sm rounded-3xl border border-sage-line bg-white p-7 shadow-warm">
        <h1 className="font-display text-2xl font-black tracking-tight text-char">Welcome in.</h1>
        <p className="mt-1.5 text-sm text-muted">Sign in to plan your week and save your kitchen.</p>

        <div className="mt-6 space-y-3">
          {AUTH_PROVIDERS.google && (
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo });
              }}
            >
              <button className="w-full rounded-xl border border-sage-line bg-white py-3 text-sm font-semibold text-char transition hover:bg-sage/40">
                Continue with Google
              </button>
            </form>
          )}

          {AUTH_PROVIDERS.resend && (
            <form
              action={async (formData: FormData) => {
                "use server";
                await signIn("resend", { email: String(formData.get("email")), redirectTo });
              }}
              className="space-y-2"
            >
              <input
                name="email"
                type="email"
                required
                placeholder="you@dinner.com"
                className="w-full rounded-xl border border-sage-line bg-white px-4 py-3 text-sm outline-none focus:border-basil focus:ring-2 focus:ring-basil/20"
              />
              <button className="w-full rounded-xl bg-basil py-3 text-sm font-semibold text-oat transition hover:bg-forest">
                Email me a magic link
              </button>
            </form>
          )}

          {AUTH_PROVIDERS.dev && (
            <form
              action={async (formData: FormData) => {
                "use server";
                await signIn("dev", { email: String(formData.get("email")), redirectTo });
              }}
              className="space-y-2"
            >
              {(AUTH_PROVIDERS.google || AUTH_PROVIDERS.resend) && (
                <div className="flex items-center gap-3 py-1 text-xs font-medium uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-sage-line" />
                  dev sign-in
                  <span className="h-px flex-1 bg-sage-line" />
                </div>
              )}
              <input
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-sage-line bg-white px-4 py-3 text-sm outline-none focus:border-basil focus:ring-2 focus:ring-basil/20"
              />
              <button className="w-full rounded-xl bg-forest py-3 text-sm font-semibold text-oat transition hover:bg-basil">
                Sign in (dev)
              </button>
              <p className="text-[0.7rem] text-muted">
                Local development only — no password, no email sent.
              </p>
            </form>
          )}
        </div>
      </div>

      <p className="mt-6 max-w-sm text-center text-xs text-muted">
        By continuing you agree to Forkcast&apos;s Terms and Privacy Policy.
      </p>
    </main>
  );
}
