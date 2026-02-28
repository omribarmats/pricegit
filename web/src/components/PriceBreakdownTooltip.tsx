"use client";

import { useState, useRef, useEffect } from "react";

interface PriceBreakdownTooltipProps {
  price: number;
  basePrice?: number | null;
  shippingCost?: number | null;
  fees?: number | null;
  currency: string;
  isFinalPrice?: boolean;
  children: React.ReactNode;
}

export default function PriceBreakdownTooltip({
  price,
  basePrice,
  shippingCost,
  fees,
  currency,
  isFinalPrice,
  children,
}: PriceBreakdownTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);

  // Only show tooltip if we have breakdown data
  const hasBreakdown =
    basePrice != null || shippingCost != null || fees != null;

  const totalValue = isFinalPrice === false ? null : price;

  useEffect(() => {
    if (showTooltip && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
      });
    }
  }, [showTooltip]);

  // Close tooltip on scroll
  useEffect(() => {
    if (showTooltip) {
      const handleScroll = () => setShowTooltip(false);
      window.addEventListener("scroll", handleScroll, true);
      return () => window.removeEventListener("scroll", handleScroll, true);
    }
  }, [showTooltip]);

  if (!hasBreakdown) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={triggerRef}
        className="relative inline-block"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {children}
      </div>

      {showTooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px]"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600">base-price</span>
              {basePrice != null ? (
                <span className="font-medium">
                  {currency}
                  {basePrice.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400">?</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">shipping</span>
              {shippingCost != null ? (
                <span className="font-medium">
                  {currency}
                  {shippingCost.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400">?</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">fees</span>
              {fees != null ? (
                <span className="font-medium">
                  {currency}
                  {fees.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400">?</span>
              )}
            </div>
            <div className="flex justify-between pt-1 border-t border-gray-200">
              <span className="text-gray-900 font-medium"></span>
              {totalValue != null ? (
                <span className="font-bold">
                  {currency}
                  {totalValue.toFixed(2)}
                </span>
              ) : (
                <span className="text-gray-400">?</span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
