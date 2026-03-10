"use client";

import { useState, useEffect, ReactNode } from "react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Slide {
  title: string;
  description: string;
  illustration: ReactNode;
}

// SVG illustrations — consistent across all devices
const ShoppingBagIcon = () => (
  <svg className="w-24 h-24 mx-auto" viewBox="0 0 80 80" fill="none">
    <rect x="16" y="28" width="48" height="40" rx="4" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="2" />
    <path d="M28 28V22a12 12 0 0 1 24 0v6" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    <circle cx="33" cy="42" r="2" fill="#3B82F6" />
    <circle cx="47" cy="42" r="2" fill="#3B82F6" />
    <path d="M30 52a10 10 0 0 0 20 0" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
    <text x="40" y="48" textAnchor="middle" fontSize="14" fill="#3B82F6" fontWeight="bold">$</text>
  </svg>
);

const ShieldCheckIcon = () => (
  <svg className="w-24 h-24 mx-auto" viewBox="0 0 80 80" fill="none">
    <path d="M40 8L12 22v18c0 16.6 11.9 32.1 28 36 16.1-3.9 28-19.4 28-36V22L40 8z" fill="#DCFCE7" stroke="#22C55E" strokeWidth="2" />
    <path d="M28 40l8 8 16-16" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SearchPriceIcon = () => (
  <svg className="w-24 h-24 mx-auto" viewBox="0 0 80 80" fill="none">
    <circle cx="34" cy="34" r="20" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="2" />
    <path d="M50 50l16 16" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <text x="34" y="40" textAnchor="middle" fontSize="18" fill="#F59E0B" fontWeight="bold">$</text>
    <path d="M26 28h16M26 36h12" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const HandshakeIcon = () => (
  <svg className="w-24 h-24 mx-auto" viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="30" fill="#EDE9FE" stroke="#8B5CF6" strokeWidth="2" />
    <path d="M22 40h8l6-4 8 4 8-4 6 4h8" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 40v-8M50 40v-8" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
    <path d="M34 48a8 8 0 0 0 12 0" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const slides: Slide[] = [
  {
    title: "1. Shoppers Submit Prices",
    description:
      "Shoppers use our free browser extension to submit prices from online stores. Every submission includes price breakdown, store details, and location",
    illustration: <ShoppingBagIcon />,
  },
  {
    title: "2. Community Verification",
    description:
      "Each price submission is reviewed by our community moderators to ensure accuracy and prevent fake prices. Only verified prices are published.",
    illustration: <ShieldCheckIcon />,
  },
  {
    title: "3. Find Best Prices for You",
    description:
      "Browse verified prices relevant to your location. Compare prices across stores, see price history, and find the best deal available.",
    illustration: <SearchPriceIcon />,
  },
  {
    title: "4. Help Verify Prices",
    description:
      "Become a price verifier. Use the browser extension to submit prices from stores and help others discover better alternatives.",
    illustration: <HandshakeIcon />,
  },
];

export function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Reset to first slide when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      onClose();
      setCurrentSlide(0);
    } else {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const slide = slides[currentSlide];

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 cursor-pointer"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center">
          {/* Illustration */}
          <div className="mb-6">
            {slide.illustration}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {slide.title}
          </h2>

          {/* Description */}
          <p className="text-gray-600 mb-8 leading-relaxed">
            {slide.description}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  index === currentSlide
                    ? "w-8 bg-blue-600"
                    : "w-2 bg-gray-300 hover:bg-gray-400"
                }`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-3">
            {!isLastSlide && (
              <button
                onClick={handleNext}
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Next
              </button>
            )}
            {isLastSlide && (
              <a
                href="https://chromewebstore.google.com/detail/ijgedommhklafmckdjjfpaklhfejandi?utm_source=item-share-cb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center cursor-pointer"
              >
                Get Chrome Extension
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
