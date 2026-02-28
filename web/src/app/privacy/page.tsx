import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read the PriceGit Privacy Policy.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com"}/privacy`,
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
          Privacy Policy
        </h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Introduction
            </h2>
            <p>
              At PriceGit, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Information We Collect
            </h2>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Account information (username, email address, password)</li>
              <li>
                Location information (city, country) for regional price
                comparisons
              </li>
              <li>Price submissions and product information you contribute</li>
              <li>Any other information you choose to provide</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              2.2 Automatically Collected Information
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>IP address and approximate location</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              2.3 Screenshot Processing
            </h3>
            <p className="mb-3">
              When you use our browser extension to capture prices, you may
              submit screenshots of product pages. These screenshots are:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sent to AI services for automated price extraction only</li>
              <li>
                Processed temporarily and immediately deleted after price
                extraction
              </li>
              <li>
                Never stored on our servers beyond the processing duration
              </li>
              <li>Never used for AI training or any other purpose</li>
              <li>
                Never shared with third parties except for the immediate
                processing purpose
              </li>
            </ul>
            <p className="mt-3">
              We do not retain any screenshots after the price information has
              been extracted.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              2.4 Location Data Specifics
            </h3>
            <p className="mb-3">
              Our location data collection is limited and privacy-focused:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>City-level only:</strong> We only collect city and
                country information, never precise GPS coordinates or street
                addresses
              </li>
              <li>
                <strong>Purpose-limited:</strong> Location is only collected
                during price capture to provide regional price comparisons
              </li>
              <li>
                <strong>User-controlled:</strong> You can manually set or change
                your location at any time
              </li>
              <li>
                <strong>Optional display:</strong> You control whether your
                location is visible in your public profile
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="mb-3">We use your information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide and maintain our service</li>
              <li>Display location-relevant price information</li>
              <li>Communicate with you about your account and updates</li>
              <li>Improve and optimize our service</li>
              <li>Prevent fraud and ensure platform integrity</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Information Sharing
            </h2>
            <p className="mb-3">
              We do not sell your personal information. We may share your
              information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Public Information:</strong> Username and price
                submissions are publicly visible as part of the community-driven
                nature of the platform
              </li>
              <li>
                <strong>Service Providers:</strong> With third-party service
                providers who help us operate our service (e.g., hosting,
                analytics)
              </li>
              <li>
                <strong>Legal Requirements:</strong> When required by law or to
                protect our rights and safety
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational security
              measures to protect your information. However, no method of
              transmission over the internet or electronic storage is 100%
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Your Rights and GDPR Compliance
            </h2>
            <p className="mb-3">
              We are committed to protecting your rights under data protection
              laws, including the General Data Protection Regulation (GDPR) for
              users in the European Union.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              6.1 Your Rights
            </h3>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of all personal
                information we hold about you
              </li>
              <li>
                <strong>Rectification:</strong> Correct inaccurate or incomplete
                information
              </li>
              <li>
                <strong>Erasure ("Right to be Forgotten"):</strong> Request
                deletion of your account and all associated personal data
              </li>
              <li>
                <strong>Data Portability:</strong> Export your data in a
                structured, commonly used, machine-readable format (JSON)
              </li>
              <li>
                <strong>Restriction:</strong> Request that we limit the
                processing of your data
              </li>
              <li>
                <strong>Objection:</strong> Object to certain types of data
                processing
              </li>
              <li>
                <strong>Withdraw Consent:</strong> Opt-out of certain data
                collection practices at any time
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              6.2 Right to Erasure Details
            </h3>
            <p className="mb-3">When you request account deletion, we will:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Permanently delete your account and profile information within
                30 days
              </li>
              <li>
                Anonymize your price submissions (they remain on the platform
                but are no longer associated with you)
              </li>
              <li>
                Remove all personally identifiable information from our backups
                within 90 days
              </li>
              <li>
                Retain certain data only if required by law (e.g., for tax or
                legal compliance)
              </li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              6.3 Data Portability
            </h3>
            <p className="mb-3">
              You can export your data at any time from your account settings,
              including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Profile information (username, email, location)</li>
              <li>All price submissions with timestamps</li>
              <li>Account activity history</li>
              <li>Saved products and preferences</li>
            </ul>
            <p className="mt-3">
              Data is provided in JSON format for easy portability to other
              services.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-4">
              6.4 EU Representative
            </h3>
            <p>
              For users in the European Union, questions regarding data
              protection can be directed to our support channels. We comply with
              all applicable EU data protection regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Cookies and Tracking
            </h2>
            <p>
              We use cookies and similar technologies to enhance your
              experience, analyze usage patterns, and remember your preferences.
              You can control cookie settings through your browser, though this
              may affect service functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Third-Party Services
            </h2>
            <p>
              Our service may contain links to third-party websites or integrate
              with third-party services. We are not responsible for the privacy
              practices of these third parties. We encourage you to review their
              privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Children's Privacy
            </h2>
            <p>
              Our service is not intended for children under 13 years of age. We
              do not knowingly collect personal information from children under
              13.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. International Data Transfers
            </h2>
            <p>
              Your information may be transferred to and processed in countries
              other than your country of residence. We take steps to ensure your
              data receives adequate protection wherever it is processed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Data Retention
            </h2>
            <p>
              We retain your information for as long as necessary to provide our
              service and fulfill the purposes outlined in this policy, unless a
              longer retention period is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              12. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the new policy on
              this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              13. Contact Us
            </h2>
            <p>
              If you have questions or concerns about this Privacy Policy or our
              data practices, please contact us through our support channels.
            </p>
          </section>

          <p className="text-sm text-gray-500 mt-8 pt-8 border-t border-gray-200">
            Last updated: February 14, 2026
          </p>
        </div>
      </main>
    </div>
  );
}
