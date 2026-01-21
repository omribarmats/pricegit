"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PendingPrice {
  id: string;
  price: number;
  currency: string;
  source_url: string;
  created_at: string;
  captured_by_country: string;
  captured_by_city: string | null;
  condition: string;
  fulfillment_type: string;
  product_type: string;
  is_final_price: boolean;
  screenshot_url: string | null;
  products: {
    id: string;
    name: string;
    image_url: string | null;
  };
  stores: {
    id: string;
    name: string;
    country: string;
    city: string | null;
  };
  submitted_by_user: {
    username: string;
  } | null;
}

export default function ModeratePage() {
  const [pendingPrices, setPendingPrices] = useState<PendingPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchPendingPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setCurrentUser(user);
  }

  async function fetchPendingPrices() {
    try {
      const { data, error } = await supabase
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
          product_type,
          is_final_price,
          screenshot_url,
          submitted_by,
          products (
            id,
            name,
            image_url
          ),
          stores (
            id,
            name,
            country,
            city
          ),
          submitted_by_user:users!submitted_by (
            username
          )
        `
        )
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter out user's own submissions and transform data
      const filteredData = data
        ?.filter((price: any) => price.submitted_by !== currentUser?.id)
        .map((price: any) => ({
          ...price,
          products: Array.isArray(price.products)
            ? price.products[0]
            : price.products,
          stores: Array.isArray(price.stores) ? price.stores[0] : price.stores,
          submitted_by_user: Array.isArray(price.submitted_by_user)
            ? price.submitted_by_user[0]
            : price.submitted_by_user,
        }));

      setPendingPrices(filteredData || []);
    } catch (err) {
      console.error("Error fetching pending prices:", err);
      setError("Failed to load pending prices");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(priceId: string) {
    setReviewingId(priceId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please log in to review prices");
        return;
      }

      const response = await fetch("/api/prices/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          action: "approve",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to approve price");
        return;
      }

      // Remove from list
      setPendingPrices((prev) => prev.filter((p) => p.id !== priceId));
      alert("Price approved successfully!");
    } catch (err) {
      console.error("Error approving price:", err);
      alert("Failed to approve price");
    } finally {
      setReviewingId(null);
    }
  }

  async function handleReject(priceId: string) {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setReviewingId(priceId);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        alert("Please log in to review prices");
        return;
      }

      const response = await fetch("/api/prices/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          priceId,
          action: "reject",
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Failed to reject price");
        return;
      }

      // Remove from list
      setPendingPrices((prev) => prev.filter((p) => p.id !== priceId));
      setShowRejectModal(null);
      setRejectionReason("");
      alert("Price rejected");
    } catch (err) {
      console.error("Error rejecting price:", err);
      alert("Failed to reject price");
    } finally {
      setReviewingId(null);
    }
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Review Price Submissions</h1>
          <div className="text-center py-12">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Review Price Submissions</h1>
          <div className="text-center py-12 text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Review Price Submissions</h1>
          <p className="text-gray-600">
            Help verify price submissions from the community. You cannot review
            your own submissions.
          </p>
        </div>

        {pendingPrices.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              No pending price submissions to review
            </p>
            <p className="text-gray-400 mt-2">Check back later!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingPrices.map((price) => (
              <div key={price.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex gap-6">
                  {/* Product Image */}
                  {price.products.image_url && (
                    <div className="flex-shrink-0">
                      <img
                        src={price.products.image_url}
                        alt={price.products.name}
                        className="w-24 h-24 object-cover rounded"
                      />
                    </div>
                  )}

                  {/* Price Details */}
                  <div className="flex-1">
                    <Link
                      href={`/product/${price.products.id}/${price.products.name
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                      className="text-xl font-semibold hover:text-blue-600"
                    >
                      {price.products.name}
                    </Link>

                    <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Price:</span>{" "}
                        <span className="font-semibold text-lg">
                          {price.currency} {price.price.toFixed(2)}
                        </span>
                        {price.is_final_price && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Final Price
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-600">Store:</span>{" "}
                        <span className="font-medium">{price.stores.name}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Location:</span>{" "}
                        {price.captured_by_city
                          ? `${price.captured_by_city}, ${price.captured_by_country}`
                          : price.captured_by_country}
                      </div>
                      <div>
                        <span className="text-gray-600">Condition:</span>{" "}
                        <span className="capitalize">{price.condition}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Type:</span>{" "}
                        <span className="capitalize">
                          {price.fulfillment_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Submitted by:</span>{" "}
                        {price.submitted_by_user ? (
                          <Link
                            href={`/user/${price.submitted_by_user.username}`}
                            className="text-blue-600 hover:underline"
                          >
                            {price.submitted_by_user.username}
                          </Link>
                        ) : (
                          "Unknown"
                        )}
                      </div>
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      Submitted {formatTimeAgo(price.created_at)}
                      {price.source_url && (
                        <>
                          {" • "}
                          <a
                            href={price.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            View source
                          </a>
                        </>
                      )}
                    </div>

                    {/* Screenshot for verification */}
                    {price.screenshot_url && (
                      <div className="mt-4">
                        <span className="text-sm text-gray-600 font-medium">Screenshot proof:</span>
                        <a
                          href={price.screenshot_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2"
                        >
                          <img
                            src={price.screenshot_url}
                            alt="Price screenshot"
                            className="max-w-md max-h-64 object-contain rounded border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                          />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex flex-col gap-2">
                    <button
                      onClick={() => handleApprove(price.id)}
                      disabled={reviewingId === price.id}
                      className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {reviewingId === price.id ? "Processing..." : "Approve"}
                    </button>
                    <button
                      onClick={() => setShowRejectModal(price.id)}
                      disabled={reviewingId === price.id}
                      className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-4">
                Reject Price Submission
              </h3>
              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting this price submission:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Price seems incorrect, store location mismatch, etc."
                className="w-full border rounded p-2 mb-4 h-24"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowRejectModal(null);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectModal)}
                  disabled={
                    !rejectionReason.trim() || reviewingId === showRejectModal
                  }
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reviewingId === showRejectModal ? "Processing..." : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
