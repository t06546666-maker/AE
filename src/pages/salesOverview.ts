import { SIX_HOUR_LABELS } from '../utils';

export function salesOverviewBuckets(
  orders: Array<{ timestamp: string; amount: number }>,
  period: 'today' | 'week' | 'month',
  range: { from: string; to: string },
  now = Date.now(),
) {
  const start = Date.parse(range.from);
  const end = Date.parse(range.to);
  const dayMs = 86_400_000;
  const labels = period === 'today' ? SIX_HOUR_LABELS
    : period === 'week' ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : Array.from({ length: Math.ceil((end - start) / (7 * dayMs)) }, (_, i) => `Week ${i + 1}`);
  const buckets = labels.map(label => ({ label, sales: 0 }));
  const bucketMs = period === 'today' ? 6 * 3_600_000 : period === 'week' ? dayMs : 7 * dayMs;
  for (const order of orders) {
    const time = Date.parse(order.timestamp);
    const amount = Number(order.amount);
    if (!Number.isFinite(time) || !Number.isFinite(amount) || time < start || time >= end || time > now) continue;
    const index = Math.floor((time - start) / bucketMs);
    buckets[index].sales += amount;
  }
  return buckets;
}
