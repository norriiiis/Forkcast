"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Product analytics, active only when NEXT_PUBLIC_POSTHOG_KEY is set.
export default function Analytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key || typeof window === "undefined") return;
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      capture_pageview: true,
      person_profiles: "identified_only",
    });
  }, []);
  return null;
}
