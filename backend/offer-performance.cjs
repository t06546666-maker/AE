// Offer-period activity is not attribution: overlapping offers share purchases.
function offerWindow(offer, from, to, now = Date.now()) {
  if (offer.status !== 'approved') return null;
  const starts = Date.parse(offer.reviewed_at || offer.broadcast_at || '');
  const expires = Date.parse(offer.expires_at || '');
  if (!Number.isFinite(starts) || !Number.isFinite(expires)) return null;
  const start = Math.max(starts, from);
  const end = Math.min(expires, to, now);
  return { from: new Date(start).toISOString(), to: new Date(end).toISOString(), empty: end <= start };
}
module.exports = { offerWindow };
