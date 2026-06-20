import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getUserEntitlements } from "@/lib/entitlements";
import { prisma } from "@/lib/db";
import { geocodeAddress } from "@/lib/geo";
import { cheapestForPoint, type Basket } from "@/lib/cheapest-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pro-only: address → cheapest real store nearby for this haul.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const ent = await getUserEntitlements(user.id);
  if (!ent.cheapestStore) {
    return NextResponse.json({ error: "Pro feature", upgrade: true }, { status: 403 });
  }

  let body: { addressId?: string; aisleSubtotals?: Record<string, number>; items?: Basket["items"] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const basket: Basket = {
    aisleSubtotals: body.aisleSubtotals ?? {},
    items: Array.isArray(body.items) ? body.items : [],
  };

  // Resolve the address: explicit id, else default, else any.
  let address = body.addressId
    ? await prisma.address.findFirst({ where: { id: body.addressId, userId: user.id } })
    : null;
  address ??=
    (await prisma.address.findFirst({ where: { userId: user.id, isDefault: true } })) ??
    (await prisma.address.findFirst({ where: { userId: user.id } }));
  if (!address) {
    return NextResponse.json({ error: "No address on file", needAddress: true }, { status: 400 });
  }

  let point = address.lat != null && address.lng != null ? { lat: address.lat, lng: address.lng } : null;
  if (!point) {
    point = await geocodeAddress(address);
    if (point) {
      await prisma.address
        .update({ where: { id: address.id }, data: { lat: point.lat, lng: point.lng } })
        .catch(() => {});
    }
  }
  if (!point) return NextResponse.json({ error: "Could not locate that address" }, { status: 400 });

  const result = await cheapestForPoint(point, basket);
  return NextResponse.json({ ...result, addressLabel: address.label, addressId: address.id });
}
