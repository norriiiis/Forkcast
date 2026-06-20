import NextAuth, { type NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { sendEmail, welcomeEmail } from "@/lib/email";

// Providers are added only when their keys exist, so the app runs locally with no
// external services. A dev-only email sign-in (no password) lets us exercise the
// full signed-in/Pro experience without configuring Google or Resend.
const providers: NextAuthConfig["providers"] = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET }),
  );
}

if (process.env.RESEND_API_KEY) {
  providers.push(Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM }));
}

const devLoginEnabled = process.env.NODE_ENV !== "production" || process.env.AUTH_DEV_LOGIN === "1";
if (devLoginEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev sign-in",
      credentials: { email: { label: "Email", type: "email" } },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email || !email.includes("@")) return null;
        const user = await prisma.user.upsert({
          where: { email },
          update: {},
          create: { email, name: email.split("@")[0] },
        });
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions: edge-friendly for the optimistic proxy check, and required by the
  // dev Credentials provider. The adapter still persists users/accounts/tokens.
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  callbacks: {
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.email) {
        const { subject, html } = welcomeEmail(user.name);
        await sendEmail({ to: user.email, subject, html });
      }
      // Assign a referral code and record who referred them (from the fc_ref cookie).
      try {
        const referredByCode = (await cookies()).get("fc_ref")?.value ?? null;
        const referralCode = Math.random().toString(36).slice(2, 8);
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode, referredByCode },
        });
      } catch {
        /* non-fatal */
      }
    },
  },
});

export const AUTH_PROVIDERS = {
  google: providers.some((p) => "id" in p && p.id === "google"),
  resend: providers.some((p) => "id" in p && p.id === "resend"),
  dev: devLoginEnabled,
};
