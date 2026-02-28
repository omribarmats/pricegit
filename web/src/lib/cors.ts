const ALLOWED_ORIGINS: string[] = [
  "https://pricegit.com",
  "https://www.pricegit.com",
  process.env.NEXT_PUBLIC_EXTENSION_ID
    ? `chrome-extension://${process.env.NEXT_PUBLIC_EXTENSION_ID}`
    : "",
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "",
].filter(Boolean);

export function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}
