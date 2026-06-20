import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { allow, clientIp } from "@/lib/ratelimit";

// Prisma needs the Node runtime; never cache a write endpoint.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().trim().toLowerCase().email("That doesn't look like an email."),
  source: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  if (!(await allow("waitlist", clientIp(req), 5, 60))) {
    return NextResponse.json({ error: "Too many requests — try again shortly." }, { status: 429 });
  }
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send a JSON body with an email." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid email." },
      { status: 400 },
    );
  }

  const { email, source } = parsed.data;

  try {
    await prisma.waitlistSignup.create({
      data: { email, source: source || "launch" },
    });
    return NextResponse.json({ ok: true, status: "added" });
  } catch (e) {
    // Already on the list — treat as success so the UI stays warm, not scolding.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, status: "already" });
    }
    console.error("waitlist signup failed:", e);
    return NextResponse.json({ error: "Something went wrong on our end." }, { status: 500 });
  }
}
