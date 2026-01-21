import { notFound, redirect } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { slugify } from "@/lib/slugify";
import { ProductDetailClient } from "./ProductDetailClient";

interface PageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
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
      image_url,
      price_history (
        id,
        price,
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
        stores (
          id,
          name,
          country,
          city,
          created_at
        ),
        submitted_by_user:users!submitted_by (username)
      )
    `
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

  return <ProductDetailClient product={product} currentUserId={user?.id} />;
}
