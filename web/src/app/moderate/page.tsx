"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PendingPrice {
  id: string;
  price: number;
  base_price: number | null;
  shipping_cost: number | null;
  fees: number | null;
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
  const [userRole, setUserRole] = useState<
    "user" | "moderator" | "admin" | null
  >(null);
  const [reviewChecks, setReviewChecks] = useState<
    Record<
      string,
      {
        linkWorks?: boolean;
        priceReasonable?: boolean;
        locationValid?: boolean;
      }
    >
  >({});
  const router = useRouter();

  useEffect(() => {
    checkAuth();
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

    const { data: roleData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (roleError) {
      console.error("Failed to load user role:", roleError);
      setError("Unable to verify permissions");
      return;
    }

    const role = (roleData?.role as "user" | "moderator" | "admin") || "user";
    setUserRole(role);

    if (role !== "moderator" && role !== "admin") {
      router.push("/");
      return;
    }

    fetchPendingPrices();
  }

  async function fetchPendingPrices() {
    try {
      const { data, error } = await supabase
        .from("price_history")
        .select(
          `
          id,
          price,
          base_price,
          shipping_cost,
          fees,
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
            name
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
        `,
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

  async function handleReject(priceId: string, reason?: string) {
    const finalReason = reason || rejectionReason.trim();
    if (!finalReason) {
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
          rejectionReason: finalReason,
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

  const updateReviewCheck = (
    priceId: string,
    field: "linkWorks" | "priceReasonable" | "locationValid",
    value: boolean,
  ) => {
    setReviewChecks((prev) => ({
      ...prev,
      [priceId]: {
        ...prev[priceId],
        [field]: value,
      },
    }));
  };

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
            {pendingPrices.map((price) => {
              const checks = reviewChecks[price.id] || {};
              const isReady =
                checks.linkWorks !== undefined &&
                checks.priceReasonable !== undefined &&
                checks.locationValid !== undefined;
              const shouldReject =
                checks.linkWorks === false ||
                checks.priceReasonable === false ||
                checks.locationValid === false;
              const canSubmit = isReady;

              return (
                <div key={price.id} className="bg-white rounded-lg shadow p-6">
                  <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
                    <div className="flex gap-6">
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
                            <span className="font-semibold text-lg inline-flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${price.is_final_price ? "bg-emerald-500" : "bg-amber-400"} ring-1 ring-gray-300`}
                                role="img"
                                aria-label={
                                  price.is_final_price
                                    ? "Final price"
                                    : "Partial price"
                                }
                                title={
                                  price.is_final_price
                                    ? "Final price"
                                    : "Partial price"
                                }
                              />
                              {price.currency} {price.price.toFixed(2)}
                            </span>
                            <div className="mt-2 text-xs text-gray-600 space-y-1">
                              <div className="flex justify-between max-w-[220px]">
                                <span>Item price</span>
                                <span>
                                  {price.base_price != null
                                    ? `${price.currency}${price.base_price.toFixed(2)}`
                                    : "?"}
                                </span>
                              </div>
                              <div className="flex justify-between max-w-[220px]">
                                <span>Shipping</span>
                                <span>
                                  {price.shipping_cost != null
                                    ? `${price.currency}${price.shipping_cost.toFixed(2)}`
                                    : "?"}
                                </span>
                              </div>
                              <div className="flex justify-between max-w-[220px]">
                                <span>Fees</span>
                                <span>
                                  {price.fees != null
                                    ? `${price.currency}${price.fees.toFixed(2)}`
                                    : "?"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Store:</span>{" "}
                            <span className="font-medium">
                              {price.stores.name}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Location:</span>{" "}
                            {price.captured_by_city
                              ? `${price.captured_by_city}, ${price.captured_by_country}`
                              : price.captured_by_country}
                          </div>
                          <div>
                            <span className="text-gray-600">Condition:</span>{" "}
                            <span className="capitalize">
                              {price.condition}
                            </span>
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
                      </div>
                    </div>

                    {/* Review Panel */}
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="text-xs text-gray-500 mb-1">
                        Link to price provided by user:
                      </div>
                      {price.source_url ? (
                        <a
                          href={price.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                          title={price.source_url}
                        >
                          {price.source_url.length > 60
                            ? `${price.source_url.slice(0, 60)}...`
                            : price.source_url}
                        </a>
                      ) : (
                        <div className="text-sm text-gray-400">No link</div>
                      )}

                      <div className="mt-4 text-sm">
                        <div className="text-gray-700 mb-2">
                          Does the link work and show the correct product?
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`link-${price.id}`}
                              checked={checks.linkWorks === true}
                              onChange={() =>
                                updateReviewCheck(price.id, "linkWorks", true)
                              }
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`link-${price.id}`}
                              checked={checks.linkWorks === false}
                              onChange={() =>
                                updateReviewCheck(price.id, "linkWorks", false)
                              }
                            />
                            No
                          </label>
                        </div>
                      </div>

                      <div className="mt-4 text-sm">
                        <div className="text-gray-700 mb-2">
                          Does the price seem reasonable and match what&apos;s
                          shown on the page?
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`price-${price.id}`}
                              checked={checks.priceReasonable === true}
                              onChange={() =>
                                updateReviewCheck(
                                  price.id,
                                  "priceReasonable",
                                  true,
                                )
                              }
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`price-${price.id}`}
                              checked={checks.priceReasonable === false}
                              onChange={() =>
                                updateReviewCheck(
                                  price.id,
                                  "priceReasonable",
                                  false,
                                )
                              }
                            />
                            No
                          </label>
                        </div>
                      </div>

                      <div className="mt-4 text-sm">
                        <div className="text-gray-700 mb-2">
                          Does the location make sense for this store?
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`location-${price.id}`}
                              checked={checks.locationValid === true}
                              onChange={() =>
                                updateReviewCheck(
                                  price.id,
                                  "locationValid",
                                  true,
                                )
                              }
                            />
                            Yes
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="radio"
                              name={`location-${price.id}`}
                              checked={checks.locationValid === false}
                              onChange={() =>
                                updateReviewCheck(
                                  price.id,
                                  "locationValid",
                                  false,
                                )
                              }
                            />
                            No
                          </label>
                        </div>
                      </div>

                      <div className="mt-6 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            if (!canSubmit) return;
                            if (shouldReject) {
                              const reasons: string[] = [];
                              if (checks.linkWorks === false) {
                                reasons.push(
                                  "Link broken or incorrect product",
                                );
                              }
                              if (checks.priceReasonable === false) {
                                reasons.push(
                                  "Price appears incorrect or unreasonable",
                                );
                              }
                              if (checks.locationValid === false) {
                                reasons.push("Invalid location for this store");
                              }
                              handleReject(price.id, reasons.join("; "));
                            } else {
                              handleApprove(price.id);
                            }
                          }}
                          disabled={reviewingId === price.id || !canSubmit}
                          className="px-5 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewingId === price.id
                            ? "Processing..."
                            : "Submit"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
