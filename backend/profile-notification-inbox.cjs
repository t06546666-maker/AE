// Server-only Firestore inboxes. Never accept a profile ID from the request body:
// callers must supply the authenticated AE profile's ID.
function createProfileNotificationInbox(getDatabase) {
  const itemsFor = async (profileId) => {
    if (typeof profileId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(profileId)) {
      throw new Error('Invalid notification profile');
    }
    const database = await getDatabase();
    return database.collection('ae_profile_notification_inboxes').doc(profileId).collection('items');
  };
  return {
    async save(profileId, title, body, data = {}) {
      const items = await itemsFor(profileId);
      const entityId = data.requestId || data.orderId || data.transactionId || data.paymentId || data.offerId || data.billId || null;
      const result = await items.add({
        title: String(title).slice(0, 160), body: String(body).slice(0, 1000),
        target_url: typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//') ? data.url.slice(0, 500) : null,
        event_type: String(data.type || 'general').slice(0, 80),
        entity_id: entityId ? String(entityId).slice(0, 160) : null,
        read_at: null, created_at: new Date().toISOString(),
      });
      return `firebase:${result.id}`;
    },
    async list(profileId, limit = 8) {
      const items = await itemsFor(profileId);
      const boundedLimit = Math.min(20, Math.max(1, Math.trunc(Number(limit)) || 8));
      const [page, unread] = await Promise.all([
        items.orderBy('created_at', 'desc').limit(boundedLimit).get(),
        items.where('read_at', '==', null).count().get(),
      ]);
      return {
        items: page.docs.map((doc) => ({ ...doc.data(), id: `firebase:${doc.id}` })),
        unreadCount: unread.data().count,
      };
    },
    async markRead(profileId, id) {
      if (typeof id !== 'string' || !/^firebase:[a-zA-Z0-9_-]{1,128}$/.test(id)) return false;
      const ref = (await itemsFor(profileId)).doc(id.slice('firebase:'.length));
      const snapshot = await ref.get();
      if (!snapshot.exists) return false;
      if (!snapshot.data().read_at) await ref.update({ read_at: new Date().toISOString() });
      return true;
    },
  };
}

module.exports = { createProfileNotificationInbox };
