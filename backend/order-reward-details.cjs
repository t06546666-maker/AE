// Read-only: use the saved checkout snapshot, never today's shop settings or
// points/bill arithmetic (small-bill tiers and caps make that misleading).
async function orderRewardDetails(db, orders) {
  const details = new Map();
  for (let offset = 0; offset < orders.length; offset += 100) {
    const batch = orders.slice(offset, offset + 100);
    const result = await db.from('ae_points_requests').select('merchant_id,parameters,result')
      .in('result->purchase->>order_id', batch.map(row => row.id)).range(0, 999);
    if (result.error) {
      if (['42P01', 'PGRST205'].includes(result.error.code)) return new Map();
      throw new Error('Saved order reward details are unavailable');
    }
    if (result.data.length === 1000) throw new Error('Saved order reward details are incomplete');
    for (const item of result.data) {
      const purchase = item.result?.purchase;
      const order = batch.find(row => row.id === purchase?.order_id && row.merchant_id === item.merchant_id);
      if (!order) continue;
      const rate = item.parameters?.rate;
      const redemption = item.result?.redemption;
      const type = item.parameters?.discountType;
      const value = item.parameters?.discountValue;
      const amount = item.result?.discountAmount;
      const noRedemption = item.parameters?.redeem === 0 && !redemption;
      const validDiscount = redemption && ['percentage', 'flat'].includes(type)
        && typeof value === 'number' && value >= 0
        && typeof amount === 'number' && amount >= 0;
      const info = {
        earningPointsPer100: typeof rate === 'number' && rate >= 0 && rate <= 100 ? rate : null,
        discountType: noRedemption ? 'none' : validDiscount ? type : null,
        discountPercentage: noRedemption ? 0 : validDiscount && type === 'percentage' ? value : null,
        discountAmount: noRedemption ? 0 : validDiscount ? amount : null,
      };
      // Conflicting snapshots must not manufacture a historical rate.
      const previous = details.get(order.id);
      details.set(order.id, previous && JSON.stringify(previous) !== JSON.stringify(info)
        ? {earningPointsPer100:null,discountType:null,discountPercentage:null,discountAmount:null} : info);
    }
  }
  return details;
}
module.exports = { orderRewardDetails };
