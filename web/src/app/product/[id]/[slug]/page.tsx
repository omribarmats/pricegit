import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";
import { ProductDetailClient } from "./ProductDetailClient";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com";

interface PageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  const { data: product } = await supabase
    .from("products")
    .select(
      `
      name,
      price_history (
        price,
        currency,
        status,
        store_id,
        captured_by_country,
        stores ( name )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (!product) {
    return { title: "Product Not Found | PriceGit" };
  }

  const approved = (product.price_history ?? []).filter(
    (p) => p.status === "approved",
  );

  const storeCount = new Set(approved.map((p) => p.store_id).filter(Boolean))
    .size;
  const countryCount = new Set(
    approved.map((p) => p.captured_by_country).filter(Boolean),
  ).size;

  const productSlug = slugify(product.name);
  const canonicalUrl = `${BASE_URL}/product/${id}/${productSlug}`;

  const storeLabel =
    storeCount > 0
      ? `${storeCount} store${storeCount !== 1 ? "s" : ""}`
      : "multiple stores";
  const countryLabel =
    countryCount > 1
      ? ` in ${countryCount} countries`
      : countryCount === 1
        ? " in 1 country"
        : "";

  const title = `${product.name} - Compare Prices | PriceGit`;
  const description = `Compare ${product.name} prices across ${storeLabel}${countryLabel}. Community-verified prices updated in real time. Track price history and find the best deals.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${product.name} - Compare Prices | PriceGit`,
      description,
      url: canonicalUrl,
      type: "website",
      siteName: "PriceGit",
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} - Compare Prices | PriceGit`,
      description,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { id, slug } = await params;

  // Get current user to show their own pending prices
  // Note: In server components, auth.getUser() returns null for anon client
  // This is a limitation - consider implementing proper server-side auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch product by ID
  const { data: product, error } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      price_history (
        id,
        price,
        base_price,
        shipping_cost,
        fees,
        source,
        source_url,
        created_at,
        store_id,
        captured_by_country,
        captured_by_city,
        fulfillment_type,
        condition,
        product_type,
        currency,
        is_final_price,
        status,
        submitted_by,
        screenshot_url,
        stores (
          id,
          name,
          country,
          city,
          created_at
        ),
        submitted_by_user:users!submitted_by (username)
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("Product fetch error:", error);
  }

  if (error || !product) {
    notFound();
  }

  // Note: We fetch ALL prices (approved and pending) and let the client component
  // handle filtering and separation into tabs
  // The RLS policies ensure users only see:
  // - All approved prices
  // - Their own pending prices

  // Check if slug matches current product name
  const correctSlug = slugify(product.name);
  if (slug !== correctSlug) {
    // Redirect to correct slug for SEO
    redirect(`/product/${id}/${correctSlug}`);
  }

  // Build JSON-LD schema from approved prices only
  const approvedPrices = (product.price_history ?? []).filter(
    (p) => p.status === "approved",
  );

  const prices = approvedPrices.map((p) => p.price).filter((p) => p != null);
  const minPrice = prices.length > 0 ? Math.min(...prices) : null;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : null;

  // Determine dominant currency (most frequently appearing)
  const currencyCounts: Record<string, number> = {};
  for (const p of approvedPrices) {
    if (p.currency)
      currencyCounts[p.currency] = (currencyCounts[p.currency] ?? 0) + 1;
  }
  const dominantCurrency =
    Object.entries(currencyCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "USD";

  const productSchema =
    minPrice !== null
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          url: `${BASE_URL}/product/${id}/${slugify(product.name)}`,
          offers: {
            "@type": "AggregateOffer",
            lowPrice: minPrice,
            highPrice: maxPrice,
            priceCurrency: dominantCurrency,
            offerCount: approvedPrices.length,
            offers: approvedPrices.map((p) => ({
              "@type": "Offer",
              price: p.price,
              priceCurrency: p.currency ?? dominantCurrency,
              availability: "https://schema.org/InStock",
              itemCondition:
                p.condition === "used"
                  ? "https://schema.org/UsedCondition"
                  : "https://schema.org/NewCondition",
              ...(p.source_url ? { url: p.source_url } : {}),
              seller: {
                "@type": "Organization",
                name: ((p.stores as unknown) as { name: string } | null)?.name ?? "Unknown",
              },
            })),
          },
        }
      : null;

  return (
    <>
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      <ProductDetailClient product={product} currentUserId={user?.id} />
    </>
  );
}
