"use client";

import { useState } from "react";

type Tone = "light" | "dark";
type State = "idle" | "loading" | "added" | "already" | "error";

const COPY: Record<Exclude<State, "idle" | "loading">, string> = {
  added: "You're in. We'll send your free week the day we launch.",
  already: "You're already on the list — good taste. See you at launch.",
  error: "Hmm, that didn't go through. Mind trying again?",
};

export default function WaitlistForm({
  source = "launch",
  tone = "light",
  className = "",
}: {
  source?: string;
  tone?: Tone;
  className?: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const done = state === "added" || state === "already";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading" || done) return;
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? COPY.error);
        return;
      }
      const next = data.status === "already" ? "already" : "added";
      setState(next);
      setMessage(COPY[next]);
    } catch {
      setState("error");
      setMessage(COPY.error);
    }
  }

  const dark = tone === "dark";

  const inputClasses = dark
    ? "bg-white/10 text-oat placeholder:text-forest-sage/70 border-white/15 focus:border-oat/60 focus:ring-oat/20"
    : "bg-white text-char placeholder:text-muted/60 border-sage-line focus:border-basil focus:ring-basil/20";

  const buttonClasses = dark
    ? "bg-oat text-forest hover:bg-white"
    : "bg-basil text-oat hover:bg-forest";

  if (done) {
    return (
      <p
        className={`flex items-center gap-2 text-sm font-medium ${
          dark ? "text-oat" : "text-forest"
        } ${className}`}
        aria-live="polite"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
            dark ? "bg-oat/15 text-oat" : "bg-basil/12 text-basil"
          }`}
          aria-hidden
        >
          ✓
        </span>
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`w-full ${className}`} noValidate>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`waitlist-${source}`}>
          Email address
        </label>
        <input
          id={`waitlist-${source}`}
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="you@dinner.com"
          autoComplete="email"
          className={`tnum w-full flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2 ${inputClasses}`}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`shrink-0 rounded-xl px-5 py-3 text-sm font-semibold shadow-sm transition disabled:opacity-60 ${buttonClasses}`}
        >
          {state === "loading" ? "Adding…" : "Save my seat"}
        </button>
      </div>
      <p
        className={`mt-2 min-h-[1.25rem] text-xs ${
          state === "error"
            ? dark
              ? "text-ember"
              : "text-ember"
            : dark
              ? "text-forest-sage"
              : "text-muted"
        }`}
        aria-live="polite"
      >
        {message ?? "First week free at launch. One email, no spam, unsubscribe anytime."}
      </p>
    </form>
  );
}
