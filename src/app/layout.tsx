import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Analytics from "@/components/Analytics";

// Brand fonts: Fraunces (warm, characterful display serif) for headlines —
// italics included for the occasional hand-set accent word — and Inter for UI/body.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://forkcast.app"),
  title: "Forkcast — Plan once. Eat all week.",
  description:
    "Forkcast decides what's for dinner so you don't have to. A week of dinners that share ingredients, one aisle-sorted grocery list with the price up front, and a 90-minute Sunday prep plan. Around $5 a plate, at your own store.",
  keywords: [
    "meal planning",
    "meal prep",
    "grocery list",
    "weekly dinners",
    "budget meals",
    "what's for dinner",
  ],
  openGraph: {
    title: "Forkcast — Plan once. Eat all week.",
    description:
      "A week of dinners that share ingredients, one aisle-sorted grocery list with the price up front, and a 90-minute Sunday prep plan. Around $5 a plate.",
    type: "website",
    siteName: "Forkcast",
  },
  twitter: {
    card: "summary_large_image",
    title: "Forkcast — Plan once. Eat all week.",
    description:
      "Dinner, decided. A week of overlapping dinners, one grocery list with the price up front, and a 90-minute Sunday prep.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Arm scroll-reveal start states before first paint (and only when JS is
            on, so no-JS visitors still see everything). Uses a data attribute,
            not a class, so it doesn't collide with the font classNames React
            manages on <html>. See [data-js] [data-reveal] in globals.css. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.setAttribute('data-js','')",
          }}
        />
        <Analytics />
        {children}
      </body>
    </html>
  );
}
