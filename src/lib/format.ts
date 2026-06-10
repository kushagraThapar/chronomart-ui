/**
 * Formats a monetary amount using Intl.NumberFormat. Falls back to a plain
 * "{currency} {amount}" string when the currency code is not supported.
 */
export function formatPrice(amount: number, currency: string | undefined): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency ?? "USD",
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${currency ?? "USD"} ${amount.toFixed(2)}`;
  }
}
