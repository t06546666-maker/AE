export function flatDiscountOptions(amount: number): number[] {
  if (!Number.isFinite(amount) || amount < 100) return [];
  return amount < 200 ? [2, 5] : amount < 500 ? [2, 5, 10] : [2, 5, 10, 50];
}
