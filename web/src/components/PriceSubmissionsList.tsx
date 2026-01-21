"use client";

import Link from "next/link";

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
  reviewed_by_user: {
    username: string;
  } | null;
}

interface PriceSubmissionsListProps {
  submissions: PriceSubmission[];
  emptyMessage?: string;
}

export default function PriceSubmissionsList({
  submissions,
  emptyMessage = "No price submissions yet",
}: PriceSubmissionsListProps) {
  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Pending Review
          </span>
        );
      case "approved":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Approved
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Rejected
          </span>
        );
      default:
        return null;
    }
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submissions.map((submission) => (
        <div
          key={submission.id}
          className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex gap-4">
            {/* Product Image */}
            {submission.products.image_url && (
              <div className="flex-shrink-0">
                <img
                  src={submission.products.image_url}
                  alt={submission.products.name}
                  className="w-20 h-20 object-cover rounded"
                />
              </div>
            )}

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/product/${
                    submission.products.id
                  }/${submission.products.name
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
                  className="font-semibold text-lg hover:text-blue-600 truncate"
                >
                  {submission.products.name}
                </Link>
                {getStatusBadge(submission.status)}
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Price:</span>{" "}
                  <span className="font-semibold">
                    {submission.currency} {submission.price.toFixed(2)}
                  </span>
                  {submission.is_final_price && (
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                      Final
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-gray-600">Store:</span>{" "}
                  <span className="font-medium">{submission.stores.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Location:</span>{" "}
                  {submission.captured_by_city
                    ? `${submission.captured_by_city}, ${submission.captured_by_country}`
                    : submission.captured_by_country}
                </div>
                <div>
                  <span className="text-gray-600">Condition:</span>{" "}
                  <span className="capitalize">{submission.condition}</span>
                </div>
              </div>

              <div className="mt-2 text-xs text-gray-500">
                Submitted {formatTimeAgo(submission.created_at)}
                {submission.reviewed_at && (
                  <>
                    {" • "}
                    Reviewed {formatTimeAgo(submission.reviewed_at)}
                    {submission.reviewed_by_user && (
                      <>
                        {" by "}
                        <Link
                          href={`/user/${submission.reviewed_by_user.username}`}
                          className="text-blue-600 hover:underline"
                        >
                          {submission.reviewed_by_user.username}
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Rejection Reason */}
              {submission.status === "rejected" &&
                submission.rejection_reason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm">
                    <span className="font-medium text-red-900">
                      Rejection reason:
                    </span>{" "}
                    <span className="text-red-800">
                      {submission.rejection_reason}
                    </span>
                  </div>
                )}

              {/* Source Link */}
              {submission.source_url && (
                <div className="mt-2">
                  <a
                    href={submission.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View source →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
