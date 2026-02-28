import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import UserProfileClient from "./UserProfileClient";

interface PageProps {
  params: Promise<{
    username: string;
  }>;
}

interface StarredProduct {
  id: string;
  created_at: string;
  products: {
    id: string;
    name: string;
  };
}

interface UserProfile {
  id: string;
  username: string;
  country: string | null;
  city: string | null;
  created_at: string;
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;

  // Fetch user profile
  const { data: userProfile, error: userError } = await supabase
    .from("users")
    .select("id, username, country, city, created_at")
    .eq("username", username)
    .single();

  if (userError || !userProfile) {
    notFound();
  }

  // Fetch user's starred products
  const { data: starredProducts } = await supabase
    .from("starred_products")
    .select(
      `
      id,
      created_at,
      products (
        id,
        name
      )
    `,
    )
    .eq("user_id", userProfile.id)
    .order("created_at", { ascending: false });

  const profile = userProfile as UserProfile;
  const starred = (starredProducts || []) as unknown as StarredProduct[];

  // Fetch user's price submissions (pending, approved, rejected)
  const { data: priceSubmissions } = await supabase
    .from("price_history")
    .select(
      `
      id,
      price,
      currency,
      source_url,
      created_at,
      captured_by_country,
      captured_by_city,
      condition,
      fulfillment_type,
      is_final_price,
      status,
      reviewed_at,
      rejection_reason,
      screenshot_url,
      products (
        id,
        name
      ),
      stores (
        id,
        name,
        country,
        city
      ),
      reviewed_by_user:users!reviewed_by (
        username
      )
    `,
    )
    .eq("submitted_by", userProfile.id)
    .order("created_at", { ascending: false });

  // Transform the data to match expected types (Supabase returns arrays for joins)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformedPriceSubmissions = (priceSubmissions || []).map(
    (submission: any) => ({
      ...submission,
      products: Array.isArray(submission.products)
        ? submission.products[0]
        : submission.products,
      stores: Array.isArray(submission.stores)
        ? submission.stores[0]
        : submission.stores,
      reviewed_by_user: Array.isArray(submission.reviewed_by_user)
        ? submission.reviewed_by_user[0] || null
        : submission.reviewed_by_user,
    }),
  );

  return (
    <UserProfileClient
      profile={profile}
      starred={starred}
      priceSubmissions={transformedPriceSubmissions}
    />
  );
}
