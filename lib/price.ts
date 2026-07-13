// Two books can only be traded when their prices are within this many baht.
// A book with no price counts as 0. Client-safe (no db imports).
export const MAX_PRICE_DIFF = 100;

export function priceDiffOk(a?: number | null, b?: number | null): boolean {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) <= MAX_PRICE_DIFF;
}
