// Dev helper: flip a user's subscription to Pro (or back to free) without Stripe.
// Usage: npx tsx scripts/dev-pro.ts <email> [on|off]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const mode = (process.argv[3] ?? "on").toLowerCase();
  if (!email) throw new Error("Usage: tsx scripts/dev-pro.ts <email> [on|off]");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No user with email ${email} — sign in once first.`);

  const pro = mode !== "off";
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: pro ? "pro" : "free",
      status: pro ? "active" : "canceled",
    },
    update: {
      plan: pro ? "pro" : "free",
      status: pro ? "active" : "canceled",
    },
  });

  console.log(`${email} → ${pro ? "Pro (active)" : "Free (canceled)"}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
