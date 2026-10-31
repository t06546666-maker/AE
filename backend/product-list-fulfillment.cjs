// Merchant fulfilment is separate from Admin approval. An order update must
// never undo approval or make an already reviewed request disappear.
const LABELS = { confirmed: 'Confirmed', in_progress: 'In progress', ready: 'Order ready', rejected: 'Rejected' };
function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return status === 'accepted' ? 'confirmed' : Object.hasOwn(LABELS, status) ? status : null;
}
function registerProductListFulfillment(app, { requireAuth, requireRole, db, pushToCustomer, pushToRole }) {
  app.patch('/api/product-list-requests/:id/status', requireAuth, requireRole('merchant'), async (req, res) => {
    const status = normalizeStatus(req.body.status);
    if (!status) return res.status(400).json({ success: false, error: 'Choose Confirmed, In progress, Order ready or Rejected.' });
    const id = String(req.params.id || '');
    const merchantId = req.auth.profile.merchant_id;
    const result = await db.from('customer_product_list_requests').select('id,customer_id,status,merchant_status').eq('id', id).eq('merchant_id', merchantId).maybeSingle();
    if (result.error) return res.status(503).json({ success: false, error: 'Unable to load this product list. Please retry.' });
    const existing = result.data;
    if (!existing) return res.status(404).json({ success: false, error: 'Product list not found' });
    if (existing.status !== 'approved') return res.status(409).json({ success: false, error: 'This product list is not approved for merchant review.' });
    if (existing.merchant_status === status) return res.json({ success: true, request: { id, status, merchant_status: status } });
    if (['ready', 'rejected'].includes(existing.merchant_status)) return res.status(409).json({ success: false, error: 'This product list is already finished. Refresh to see its current status.' });
    if (existing.merchant_status === 'in_progress' && status === 'confirmed') return res.status(409).json({ success: false, error: 'An order in progress cannot return to Confirmed.' });
    let update = db.from('customer_product_list_requests').update({ merchant_status: status }).eq('id', id).eq('merchant_id', merchantId).eq('status', 'approved');
    update = existing.merchant_status == null ? update.is('merchant_status', null) : update.eq('merchant_status', existing.merchant_status);
    const { data, error } = await update.select('id,merchant_status').maybeSingle();
    if (error) return res.status(503).json({ success: false, error: 'Unable to update product list status. Please retry.' });
    if (!data) return res.status(409).json({ success: false, error: 'This product list changed. Refresh before updating it again.' });
    const title = status === 'ready' ? 'Your order is ready' : `Product list: ${LABELS[status]}`;
    const body = { confirmed: 'The merchant confirmed your product list.', in_progress: 'The merchant is preparing your order.', ready: 'Your order is ready. Open AE to view your product list.', rejected: 'The merchant could not fulfil your product list.' }[status];
    // Notify only the owner loaded from the database, never a browser-supplied ID.
    // A delivery-provider outage must not turn a saved decision into a failed save.
    await Promise.allSettled([
      Promise.resolve().then(() => pushToCustomer(existing.customer_id, title, body, { url: `/customer/home?productList=1&requestId=${encodeURIComponent(id)}`, requestId: id, type: 'product_list', status })),
      Promise.resolve().then(() => pushToRole('admin', `Product list: ${LABELS[status]}`, body, { url: `/customer-product-lists?requestId=${encodeURIComponent(id)}`, requestId: id, type: 'product_list', status })),
    ]);
    return res.json({ success: true, request: { ...data, status } });
  });
}
module.exports = { registerProductListFulfillment, normalizeStatus, LABELS };
