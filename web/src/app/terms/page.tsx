import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Read the PriceGit Terms of Service.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || "https://pricegit.com"}/terms`,
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">
          Terms of Service
        </h1>

        <div className="prose prose-gray max-w-none space-y-6 text-gray-700">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using PriceGit, you accept and agree to be bound
              by the terms and provision of this agreement. If you do not agree
              to these terms, please do not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Description of Service
            </h2>
            <p>
              PriceGit is a community-driven platform for sharing and tracking
              product prices across different stores and regions. Users can
              submit price information, view historical price data, and compare
              prices across different locations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. User Responsibilities
            </h2>
            <p className="mb-3">When using PriceGit, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and truthful price information</li>
              <li>Not submit false, misleading, or fraudulent price data</li>
              <li>Respect the intellectual property rights of others</li>
              <li>
                Not use the service for any illegal or unauthorized purpose
              </li>
              <li>
                Not attempt to interfere with the proper functioning of the
                service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. User-Generated Content
            </h2>
            <p>
              By submitting price information or other content to PriceGit, you
              grant us a non-exclusive, worldwide, royalty-free license to use,
              display, and distribute that content in connection with the
              service. You retain all ownership rights to your content.
            </p>
            <p className="mt-3">
              You confirm that you have the right to submit any content you
              provide to the platform and that such content does not infringe
              upon the intellectual property rights of any third party.
            </p>
            <p className="mt-3">
              We reserve the right to remove any content that violates these
              terms or is deemed inappropriate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. DMCA and Copyright Policy
            </h2>
            <p className="mb-3">
              We respect the intellectual property rights of others and expect
              our users to do the same. If you believe that content on PriceGit
              infringes your copyright, please provide us with the following
              information:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-3">
              <li>
                A physical or electronic signature of the copyright owner or
                authorized representative
              </li>
              <li>
                Identification of the copyrighted work claimed to have been
                infringed
              </li>
              <li>
                Identification of the material that is claimed to be infringing
                and its location on our service
              </li>
              <li>
                Your contact information (address, telephone number, and email
                address)
              </li>
              <li>
                A statement that you have a good faith belief that the use is
                not authorized by the copyright owner
              </li>
              <li>
                A statement, under penalty of perjury, that the information in
                your notice is accurate and that you are authorized to act on
                behalf of the copyright owner
              </li>
            </ul>
            <p>
              We will respond to valid DMCA takedown notices in accordance with
              applicable law. Repeated copyright infringement by a user will
              result in account termination.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Accuracy of Information
            </h2>
            <p>
              While we strive to maintain accurate price information, PriceGit
              relies on user-submitted data. We do not guarantee the accuracy,
              completeness, or timeliness of any price information on the
              platform. Users should verify prices directly with retailers
              before making purchasing decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Account Termination
            </h2>
            <p>
              We reserve the right to suspend or terminate your account at any
              time for violations of these terms, fraudulent activity, or any
              other reason we deem appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Dispute Resolution and Arbitration
            </h2>
            <p className="mb-3">
              Any dispute, controversy, or claim arising out of or relating to
              these Terms or the use of PriceGit shall be resolved through
              binding arbitration, except that either party may seek injunctive
              or other equitable relief in a court of competent jurisdiction to
              prevent the actual or threatened infringement, misappropriation,
              or violation of a party's intellectual property rights.
            </p>
            <p className="mb-3">
              The arbitration will be conducted in accordance with the rules of
              a recognized arbitration association. The arbitrator's decision
              will be final and binding, and judgment may be entered upon it in
              any court of competent jurisdiction.
            </p>
            <p className="mb-3">
              <strong>Class Action Waiver:</strong> You agree that any
              arbitration or proceeding shall be limited to the dispute between
              you and PriceGit individually. You waive any right to participate
              in a class action lawsuit or class-wide arbitration.
            </p>
            <p>
              <strong>Opt-Out:</strong> You may opt out of this arbitration
              agreement by sending written notice within 30 days of first
              accepting these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Disclaimer of Warranties
            </h2>
            <p>
              The service is provided "as is" without warranties of any kind,
              either express or implied. We do not warrant that the service will
              be uninterrupted, error-free, or secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by law, PriceGit shall not be
              liable for any indirect, incidental, special, consequential, or
              punitive damages resulting from your use of or inability to use
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Continued
              use of the service after changes constitutes acceptance of the
              modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              12. Contact Information
            </h2>
            <p>
              If you have any questions about these Terms of Service, please
              contact us through our support channels.
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
