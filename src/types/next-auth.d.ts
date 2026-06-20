import type { DefaultSession } from "next-auth";

// Expose the database user id on the session (set in the session callback).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
