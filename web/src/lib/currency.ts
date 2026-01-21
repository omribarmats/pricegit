/**
 * Currency utilities for price conversion and formatting
 */

// Map countries to their currencies
const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  "United States": "USD",
  Israel: "ILS",
  "United Kingdom": "GBP",
  Canada: "CAD",
  Germany: "EUR",
  France: "EUR",
  Australia: "AUD",
  Japan: "JPY",
  // Add more as needed
};

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  ILS: "₪",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
  JPY: "¥",
};

/**
 * Get currency code for a country
 */
export function getCurrencyForCountry(country: string): string {
  return COUNTRY_CURRENCY_MAP[country] || "USD";
}

/**
 * Get currency symbol
 */
export function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

/**
 * Exchange rates cache (refreshed daily)
 */
let cachedRates: Record<string, number> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch exchange rates from API
 */
async function fetchExchangeRates(): Promise<Record<string, number>> {
  try {
    // Using exchangerate-api.io (free tier: 1500 requests/month)
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD"
    );
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    // Fallback rates (approximate)
    return {
      USD: 1,
      ILS: 3.65,
      EUR: 0.92,
      GBP: 0.79,
      CAD: 1.36,
      AUD: 1.53,
      JPY: 149.5,
    };
  }
}

/**
 * Get cached or fresh exchange rates
 */
async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now();

  // Check if cache is valid
  if (cachedRates && now - cacheTimestamp < CACHE_DURATION) {
    return cachedRates;
  }

  // Fetch fresh rates
  const rates = await fetchExchangeRates();
  cachedRates = rates;
  cacheTimestamp = now;

  return rates;
}

/**
 * Convert amount from one currency to another
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) {
    return amount;
  }

  const rates = await getExchangeRates();

  // Convert to USD first (base currency)
  const amountInUSD = amount / (rates[fromCurrency] || 1);

  // Convert from USD to target currency
  const convertedAmount = amountInUSD * (rates[toCurrency] || 1);

  return convertedAmount;
}

/**
 * Format price with currency symbol
 */
export function formatPrice(
  amount: number,
  currencyCode: string,
  showDecimals: boolean = true
): string {
  const symbol = getCurrencySymbol(currencyCode);
  const formatted = showDecimals
    ? amount.toFixed(2)
    : Math.round(amount).toString();

  // Some currencies put symbol after
  if (currencyCode === "ILS") {
    return `${formatted}${symbol}`;
  }

  return `${symbol}${formatted}`;
}

/**
 * Format price with original currency notation
 */
export function formatOriginalPrice(
  amount: number,
  currencyCode: string
): string {
  const formatted = amount.toFixed(2);
  return `${formatted} ${currencyCode}`;
}
