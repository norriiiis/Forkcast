import { NextResponse } from "next/server";
import { z } from "zod";
import { rankStores } from "@/lib/store-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  locationId: z.string().min(1),
  // catalog cost per aisle, in cents, e.g. { "Meat & Seafood": 1946 }
  aisleSubtotals: z.record(z.string(), z.number().nonnegative()),
});

export async function POST(req: Request) {
  let parsed;
  try {
    parsed = Body.safeParse(await req.json());
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ranking = rankStores(parsed.data.locationId, parsed.data.aisleSubtotals);
  if (!ranking) {
    return NextResponse.json({ error: "We don't cover that location yet." }, { status: 404 });
  }
  return NextResponse.json(ranking);
}
