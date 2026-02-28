"use client";

import { useState, useEffect } from "react";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const slides = [
  {
    title: "1. Shoppers Submit Prices",
    description:
      "Shoppers use our free browser extension to submit prices from online stores. Every submission includes price breakdown, store details, and location",
    illustration: "🛍️",
  },
  {
    title: "2. Community Verification",
    description:
      "Each price submission is reviewed by our community moderators to ensure accuracy and prevent fake prices. Only verified prices are published.",
    illustration: "✅",
  },
  {
    title: "3. Find Best Prices for You",
    description:
      "Browse verified prices relevant to your location. Compare prices across stores, see price history, and find the best deal available.",
    illustration: "💰",
  },
  {
    title: "4. Help Verify Prices",
    description:
      "Become a price verifier. Use the browser extension to submit prices from stores and help others discover better alternatives.",
    illustration: "🤝",
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
            <div className="text-8xl mb-4">{slide.illustration}</div>
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
                href="https://chrome.google.com/webstore"
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
