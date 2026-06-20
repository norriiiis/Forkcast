"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getUserEntitlements } from "@/lib/entitlements";
import { geocodeAddress } from "@/lib/geo";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user.id;
}

function revalidate() {
  revalidatePath("/account");
  revalidatePath("/app");
}

/** Add a geocoded address (Pro). The first one becomes the default. */
export async function addAddress(formData: FormData) {
  const userId = await requireUserId();
  const ent = await getUserEntitlements(userId);
  if (!ent.cheapestStore) redirect("/pricing");

  const addr = {
    label: String(formData.get("label") || "Home").slice(0, 40),
    line1: String(formData.get("line1") || "").trim().slice(0, 120),
    line2: String(formData.get("line2") || "").trim().slice(0, 120) || null,
    city: String(formData.get("city") || "").trim().slice(0, 80),
    region: String(formData.get("region") || "").trim().slice(0, 40),
    postalCode: String(formData.get("postalCode") || "").trim().slice(0, 12),
    country: "US",
  };
  if (!addr.line1 || !addr.city || !addr.postalCode) return;

  const point = await geocodeAddress(addr);
  const existing = await prisma.address.count({ where: { userId } });
  await prisma.address.create({
    data: { userId, ...addr, lat: point?.lat ?? null, lng: point?.lng ?? null, isDefault: existing === 0 },
  });
  revalidate();
}

export async function deleteAddress(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  await prisma.address.deleteMany({ where: { id, userId } });
  // Ensure one address stays default.
  const remaining = await prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  if (remaining && !(await prisma.address.findFirst({ where: { userId, isDefault: true } }))) {
    await prisma.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
  }
  revalidate();
}

export async function setDefaultAddress(formData: FormData) {
  const userId = await requireUserId();
  const id = String(formData.get("id") || "");
  await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  await prisma.address.updateMany({ where: { id, userId }, data: { isDefault: true } });
  revalidate();
}
