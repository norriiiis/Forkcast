import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://forkcast.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/app", "/api/"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
