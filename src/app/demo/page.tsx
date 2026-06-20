import Planner from "@/components/Planner";

export const metadata = {
  title: "Try Forkcast — plan a week free",
  description:
    "Try the Forkcast planner: a week of overlapping dinners, one aisle-sorted grocery list with the price up front, and a 90-minute Sunday prep plan.",
};

// Public, ungated teaser — the try-before-signup funnel. Unlimited and shows the
// (modeled) cheapest-store. The signed-in product lives at /app.
export default function DemoPage() {
  return <Planner mode="demo" />;
}
