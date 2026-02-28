"use client";

import { useState } from "react";

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
  submitted_by_user?: {
    username: string;
  } | null;
}

interface PriceReviewModalProps {
  priceData: PendingPrice;
  onApprove: (priceId: string) => void;
  onReject: (priceId: string, reason: string) => void;
  onClose: () => void;
  isReviewing: boolean;
}

export default function PriceReviewModal({
  priceData,
  onApprove,
  onReject,
  onClose,
  isReviewing,
}: PriceReviewModalProps) {
  const [reviewChecks, setReviewChecks] = useState<{
    linkWorks?: boolean;
    priceReasonable?: boolean;
    locationValid?: boolean;
  }>({});

  const updateReviewCheck = (
    field: "linkWorks" | "priceReasonable" | "locationValid",
    value: boolean,
  ) => {
    setReviewChecks((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const isReady =
    reviewChecks.linkWorks !== undefined &&
    reviewChecks.priceReasonable !== undefined &&
    reviewChecks.locationValid !== undefined;

  const shouldReject =
    reviewChecks.linkWorks === false ||
    reviewChecks.priceReasonable === false ||
    reviewChecks.locationValid === false;

  const canSubmit = isReady;

  const handleSubmit = () => {
    if (!canSubmit) return;

    if (shouldReject) {
      const reasons: string[] = [];
      if (reviewChecks.linkWorks === false) {
        reasons.push("Link broken or incorrect product");
      }
      if (reviewChecks.priceReasonable === false) {
        reasons.push("Price appears incorrect or unreasonable");
      }
      if (reviewChecks.locationValid === false) {
        reasons.push("Invalid location for this store");
      }
      onReject(priceData.id, reasons.join("; "));
    } else {
      onApprove(priceData.id);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-300">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Review Price Submission</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Price Info */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Product:</span>{" "}
                {priceData.products?.name || "Unknown"}
              </div>
              <div>
                <span className="font-medium">Store:</span>{" "}
                {priceData.stores?.name || "Unknown"}
              </div>
              <div>
                <span className="font-medium">Price:</span> {priceData.currency}{" "}
                {priceData.price.toFixed(2)}
              </div>
              <div className="text-xs text-gray-600 space-y-1 mt-2">
                <div className="flex justify-between max-w-[220px]">
                  <span>Item price</span>
                  <span>
                    {priceData.base_price != null
                      ? `${priceData.currency}${priceData.base_price.toFixed(2)}`
                      : "?"}
                  </span>
                </div>
                <div className="flex justify-between max-w-[220px]">
                  <span>Shipping</span>
                  <span>
                    {priceData.shipping_cost != null
                      ? `${priceData.currency}${priceData.shipping_cost.toFixed(2)}`
                      : "?"}
                  </span>
                </div>
                <div className="flex justify-between max-w-[220px]">
                  <span>Fees</span>
                  <span>
                    {priceData.fees != null
                      ? `${priceData.currency}${priceData.fees.toFixed(2)}`
                      : "?"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Source Link */}
          <div className="mb-6">
            <div className="text-xs text-gray-500 mb-1">
              Link to price provided by user:
            </div>
            {priceData.source_url ? (
              <a
                href={priceData.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
                title={priceData.source_url}
              >
                {priceData.source_url.length > 60
                  ? `${priceData.source_url.slice(0, 60)}...`
                  : priceData.source_url}
              </a>
            ) : (
              <div className="text-sm text-gray-400">No link</div>
            )}
          </div>

          {/* Review Checks */}
          <div className="space-y-4 mb-6">
            {/* Check 1: Link Works */}
            <div className="text-sm">
              <div className="text-gray-700 mb-2">
                Does the link work and show the correct product?
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="link-works"
                    checked={reviewChecks.linkWorks === true}
                    onChange={() => updateReviewCheck("linkWorks", true)}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="link-works"
                    checked={reviewChecks.linkWorks === false}
                    onChange={() => updateReviewCheck("linkWorks", false)}
                  />
                  No
                </label>
              </div>
            </div>

            {/* Check 2: Price Reasonable */}
            <div className="text-sm">
              <div className="text-gray-700 mb-2">
                Does the price seem reasonable and match what&apos;s shown on
                the page?
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="price-reasonable"
                    checked={reviewChecks.priceReasonable === true}
                    onChange={() => updateReviewCheck("priceReasonable", true)}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="price-reasonable"
                    checked={reviewChecks.priceReasonable === false}
                    onChange={() => updateReviewCheck("priceReasonable", false)}
                  />
                  No
                </label>
              </div>
            </div>

            {/* Check 3: Location Valid */}
            <div className="text-sm">
              <div className="text-gray-700 mb-2">
                Does the location make sense for this store?
              </div>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="location-valid"
                    checked={reviewChecks.locationValid === true}
                    onChange={() => updateReviewCheck("locationValid", true)}
                  />
                  Yes
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="location-valid"
                    checked={reviewChecks.locationValid === false}
                    onChange={() => updateReviewCheck("locationValid", false)}
                  />
                  No
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isReviewing || !canSubmit}
              className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReviewing ? "Processing..." : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
