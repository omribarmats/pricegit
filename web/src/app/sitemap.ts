import { MetadataRoute } from "next";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, created_at");

  const productUrls: MetadataRoute.Sitemap =
    products?.map((p) => ({
      url: `${BASE_URL}/product/${p.id}/${slugify(p.name)}`,
      lastModified: new Date(p.created_at),
      changeFrequency: "daily",
      priority: 0.8,
    })) ?? [];

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: new Date("2026-02-14"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date("2026-02-14"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...productUrls,
  ];
}
