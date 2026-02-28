import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com";

export const metadata: Metadata = {
  title: "PriceGit - Shared Price Knowledge",
  description:
    "Track and compare product prices across stores and countries. Community-verified prices updated in real time. Find the best deals on electronics, software, and more.",
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "PriceGit - Shared Price Knowledge",
    description:
      "Compare prices across stores and countries. Community-driven price tracking with real-time data.",
    url: BASE_URL,
    type: "website",
  },
  twitter: {
    title: "PriceGit - Shared Price Knowledge",
    description:
      "Compare prices across stores and countries. Community-driven price tracking with real-time data.",
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "PriceGit",
  url: BASE_URL,
  description:
    "Community-driven price tracking and comparison platform. Compare prices across stores and countries.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

interface Stats {
  productCount: number;
  priceCount: number;
  userCount: number;
}

interface RecentActivity {
  id: string;
  productId: string;
  productName: string;
  username: string;
  price: number;
  storeName: string;
  storeUrl: string;
  createdAt: string;
}

interface PopularProduct {
  id: string;
  name: string;
}

async function getHomePageData(): Promise<{
  stats: Stats;
  recentActivity: RecentActivity[];
  popularProducts: PopularProduct[];
}> {
  // Fetch stats
  const [productsResult, pricesResult, usersResult] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("price_history").select("id", { count: "exact", head: true }),
    supabase.from("users").select("id", { count: "exact", head: true }),
  ]);

  const stats: Stats = {
    productCount: productsResult.count || 0,
    priceCount: pricesResult.count || 0,
    userCount: usersResult.count || 0,
  };

  // Fetch recent activity with joined relations (single query instead of N+1)
  const { data: recentData } = await supabase
    .from("price_history")
    .select("id, product_id, price, source_url, created_at, products(name), stores(name), users(username)")
    .order("created_at", { ascending: false })
    .limit(5);

  const recentActivity: RecentActivity[] = (recentData || []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    productId: item.product_id as string,
    productName: (item.products as Record<string, unknown>)?.name as string || "Unknown product",
    username: (item.users as Record<string, unknown>)?.username as string || "Anonymous",
    price: (item.price as number) || 0,
    storeName: (item.stores as Record<string, unknown>)?.name as string || "Unknown store",
    storeUrl: (item.source_url as string) || "#",
    createdAt: item.created_at as string,
  }));

  // Fetch popular products
  const { data: popularData } = await supabase
    .from("products")
    .select("id, name")
    .limit(8);

  const popularProducts: PopularProduct[] = popularData || [];

  return { stats, recentActivity, popularProducts };
}

export default async function Home() {
  const { stats, recentActivity, popularProducts } = await getHomePageData();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <HomePage
        initialStats={stats}
        initialRecentActivity={recentActivity}
        initialPopularProducts={popularProducts}
      />
    </>
  );
}
