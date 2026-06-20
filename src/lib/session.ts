import { auth } from "@/auth";

/** The signed-in user (id, email, name, image) or null. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
