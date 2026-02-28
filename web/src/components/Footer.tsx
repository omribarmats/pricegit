export function Footer() {
  return (
    <footer className="py-8 px-6 bg-[#F5EDF5]/20 border-t border-gray-200">
      <blockquote className="text-sm text-center text-gray-600 max-w-xl mx-auto">
        &ldquo;When the knowledge of the relevant facts is dispersed among many
        people, prices can act to coordinate the separate actions of different
        people&rdquo;
        <cite className="block text-xs text-gray-500 mt-2">
          - Friedrich Hayek (The Use of Knowledge in Society, 1945)
        </cite>
      </blockquote>
      
      <div className="flex justify-center gap-6 mt-6 text-xs">
        <a
          href="/mission"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          Our Mission
        </a>
        <a
          href="/terms"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          Terms of Service
        </a>
        <a
          href="/privacy"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          Privacy Policy
        </a>
      </div>
    </footer>
  );
}
