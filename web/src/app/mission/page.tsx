import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Our Mission",
  description:
    "Why PriceGit exists: community-verified pricing with full transparency. No affiliate links. No paid placements.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com"}/mission`,
  },
  robots: { index: true, follow: true },
};

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
          Our Mission
        </h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700 text-lg leading-relaxed">
          <p>
            Price comparison today serves retailers, not shoppers. Affiliate
            commissions corrupt recommendations. Geo-targeted pricing hides true
            costs. Hidden fees appear only at checkout.
          </p>

          <p>
            This isn&apos;t transparency. It&apos;s systematic information
            asymmetry designed to extract maximum value from consumers.
          </p>

          <p className="text-xl font-semibold text-gray-900">
            PriceGit exists to fix this.
          </p>

          <p>
            We&apos;re building a community-verified price database where real
            shoppers share the real prices they see&mdash;final prices including
            shipping, customs, and every fee. No affiliate links. No paid
            rankings. No conflicts of interest.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
            Our commitment:
          </h2>

          <ul className="list-disc pl-6 space-y-2">
            <li>Every price is community-verified and timestamped</li>
            <li>Price history is tracked and public</li>
            <li>Geographic pricing differences are visible</li>
            <li>Our business model never compromises what you see</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-10 mb-4">
            How we&apos;ll sustain this:
          </h2>

          <p>
            Premium features for advanced users. Anonymous aggregate insights
            for market research. Blue checkmarks for verified retailers. Never
            affiliate commissions. Never pay-to-rank.
          </p>

          <p>
            Like Git revolutionized code collaboration, we&apos;re
            revolutionizing price transparency.
          </p>

          <p>
            See what people in your city are actually seeing. Compare prices
            across countries before you travel. Make informed decisions with
            complete information.
          </p>

          <p className="text-xl font-semibold text-gray-900">
            The internet promised information symmetry. We&apos;re delivering it
            for online shopping.
          </p>
        </div>
      </main>
    </div>
  );
}
