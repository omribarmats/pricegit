"use client";

import { useState } from "react";
import Link from "next/link";
import { slugify } from "@/lib/slugify";
import PriceSubmissionsList from "@/components/PriceSubmissionsList";

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

interface PriceSubmission {
  id: string;
  price: number;
  currency: string;
  source_url: string;
  created_at: string;
  captured_by_country: string;
  captured_by_city: string | null;
  condition: string;
  fulfillment_type: string;
  is_final_price: boolean;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  rejection_reason: string | null;
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
  reviewed_by_user: {
    username: string;
  } | null;
}

interface UserProfileClientProps {
  profile: UserProfile;
  starred: StarredProduct[];
  priceSubmissions: PriceSubmission[];
}

type Tab = "starred" | "pending" | "approved" | "rejected";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default function UserProfileClient({
  profile,
  starred,
  priceSubmissions,
}: UserProfileClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("starred");

  const pendingSubmissions = priceSubmissions.filter(
    (p) => p.status === "pending",
  );
  const approvedSubmissions = priceSubmissions.filter(
    (p) => p.status === "approved",
  );
  const rejectedSubmissions = priceSubmissions.filter(
    (p) => p.status === "rejected",
  );

  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Profile Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {profile.username}
          </h1>
          <div className="text-gray-500 space-y-1">
            <p>Member since {formatDate(profile.created_at)}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("starred")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === "starred"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Starred Products ({starred.length})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === "pending"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Pending verification ({pendingSubmissions.length})
            </button>
            <button
              onClick={() => setActiveTab("approved")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === "approved"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Approved ({approvedSubmissions.length})
            </button>
            <button
              onClick={() => setActiveTab("rejected")}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${
                  activeTab === "rejected"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
            >
              Rejected ({rejectedSubmissions.length})
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "starred" && (
            <>
              {starred.length === 0 ? (
                <div className="text-gray-500 text-center py-8 border border-gray-200 rounded-lg">
                  No starred products yet
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="divide-y divide-gray-200">
                    {starred.map((item) => (
                      <Link
                        key={item.id}
                        href={`/product/${item.products.id}/${slugify(
                          item.products.name,
                        )}`}
                        className="flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-5 h-5 text-yellow-500 fill-current"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-gray-900 font-medium">
                            {item.products.name}
                          </span>
                        </div>
                        <span className="text-sm text-gray-500">
                          Starred {formatDate(item.created_at)}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "pending" && (
            <PriceSubmissionsList
              submissions={pendingSubmissions}
              emptyMessage="No pending price submissions"
            />
          )}

          {activeTab === "approved" && (
            <PriceSubmissionsList
              submissions={approvedSubmissions}
              emptyMessage="No approved price submissions yet"
            />
          )}

          {activeTab === "rejected" && (
            <PriceSubmissionsList
              submissions={rejectedSubmissions}
              emptyMessage="No rejected price submissions"
            />
          )}
        </div>
      </main>
    </div>
  );
}
