export function flatDiscountOptions(amount: number): number[] {
  if (!Number.isFinite(amount) || amount < 1) return [];
  if (amount < 100) return [1, 2, 5].filter(value => value <= amount);
  return amount < 200 ? [2, 5] : amount < 500 ? [2, 5, 10] : [2, 5, 10, 50];
}
