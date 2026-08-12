export function isStripePriceId(value: string): boolean {
  return value.startsWith("price_");
}
