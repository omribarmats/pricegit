import { HomePage } from "@/components/HomePage";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Fetch recent activity
  const { data: recentData } = await supabase
    .from("price_history")
    .select(`
      id,
      created_at,
      product_id,
      products (name)
    `)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentActivity: RecentActivity[] = recentData
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentData.map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.products?.name || "Unknown product",
        username: "Community",
        createdAt: item.created_at,
      }))
    : [];

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
    <HomePage
      initialStats={stats}
      initialRecentActivity={recentActivity}
      initialPopularProducts={popularProducts}
    />
  );
}
