import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "PriceGit Product Price Comparison";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ id: string; slug: string }>;
}

function titleizeFromSlug(slug: string) {
  try {
    const s = decodeURIComponent(slug).replace(/-/g, " ");
    return s
      .split(" ")
      .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : ""))
      .join(" ");
  } catch {
    return slug;
  }
}

export default async function Image({ params }: Props) {
  const { slug } = await params;

  // Derive product name from slug so image rendering works without DB
  const productName = titleizeFromSlug(slug ?? "Product");

  const sloganLine1 = "Shared Price Knowledge";
  const sloganLine2 = "Compare prices submitted by shoppers near you";

  try {
    return new ImageResponse(
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(180deg, #0b1220 0%, #111827 100%)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px",
          boxSizing: "border-box",
        }}
      >
        {/* Top row: emoji/logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
            }}
          >
            {/* coin emoji as logo */}
            <span style={{ transform: "translateY(-2px)" }}>🪙</span>
          </div>
          <div style={{ color: "#E6EEF8", fontSize: 28, fontWeight: 700 }}>
            PriceGit
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            maxWidth: 840,
          }}
        >
          <div
            style={{
              color: "#F8FAFC",
              fontSize: productName.length > 40 ? 46 : 64,
              fontWeight: 800,
              lineHeight: 1.05,
            }}
          >
            {productName}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: "#9AA6B2", fontSize: 20, fontWeight: 600 }}>
              {sloganLine1}
            </div>
            <div style={{ color: "#94A3B8", fontSize: 18 }}>{sloganLine2}</div>
          </div>
        </div>

        {/* Bottom tag */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(99,102,241,0.08)",
            border: "1px solid rgba(99,102,241,0.2)",
            borderRadius: 10,
            padding: "10px 16px",
            color: "#C7D2FE",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          pricegit.com
        </div>
      </div>,
      size,
    );
  } catch (err) {
    // Log the error and return a minimal fallback (text-only) to avoid 500
    // console.error will appear in terminal where Next.js runs
    console.error("OG image render error:", err);
    return new ImageResponse(
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0b1220",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 36,
          fontFamily: "Arial, sans-serif",
        }}
      >
        {productName}
      </div>,
      size,
    );
  }
}
