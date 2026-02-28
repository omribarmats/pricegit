import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderate",
  robots: { index: false, follow: false },
};

export default function ModerateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
