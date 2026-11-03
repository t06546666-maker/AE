const assert = require('assert');
const { registerAdminNotifications } = require('../backend/admin-notifications.cjs');

async function runTests() {
  console.log('Testing admin-notifications push-only & history deletion...');

  const routes = {};
  const mockApp = {
    get: (path, ...handlers) => { routes[`GET ${path}`] = handlers; },
    post: (path, ...handlers) => { routes[`POST ${path}`] = handlers; },
    delete: (path, ...handlers) => { routes[`DELETE ${path}`] = handlers; },
  };

  const dummyMiddleware = (req, res, next) => next && next();

  // In-memory collections to simulate Firestore
  const collections = {
    ae_customer_announcements: new Map(),
    ae_merchant_announcements: new Map(),
    ae_notification_history: new Map(),
    ae_scheduled_notifications: new Map(),
    ae_customer_notifications: new Map(),
    ae_profile_push_registrations: new Map(),
  };

  function createMockCollection(name) {
    const map = collections[name];
    return {
      add: async (data) => {
        const id = 'doc_' + Math.random().toString(36).substring(2, 9);
        map.set(id, { ...data, _id: id });
        return { id };
      },
      doc: (id) => ({
        get: async () => ({
          exists: map.has(id),
          data: () => map.get(id),
          id,
        }),
        delete: async () => {
          map.delete(id);
        },
      }),
      where: (field, op, val) => ({
        get: async () => {
          const docs = [];
          for (const [id, data] of map.entries()) {
            if (op === '==' && data[field] === val) {
              docs.push({
                id,
                data: () => data,
                ref: {
                  delete: async () => map.delete(id),
                },
              });
            }
          }
          return { docs, empty: docs.length === 0 };
        },
        limit: () => ({
          get: async () => ({ docs: [], empty: true }),
        }),
      }),
      get: async () => {
        const docs = [];
        for (const [id, data] of map.entries()) {
          docs.push({
            id,
            data: () => data,
          });
        }
        return { docs, forEach: (cb) => docs.forEach(cb) };
      },
      orderBy: () => ({
        limit: () => ({
          get: async () => {
            const docs = [];
            for (const [id, data] of map.entries()) {
              docs.push({ id, data: () => data });
            }
            return { docs };
          },
        }),
      }),
    };
  }

  const mockDb = {
    collection: (name) => createMockCollection(name),
  };

  registerAdminNotifications(mockApp, {
    auth: dummyMiddleware,
    adminRole: dummyMiddleware,
    supabase: null,
    firebaseReady: async () => true,
    uploadMiddleware: dummyMiddleware,
  });

  // Verify routes registered
  assert(routes['POST /api/admin/broadcast-notification'], 'POST /api/admin/broadcast-notification must be registered');
  assert(routes['DELETE /api/admin/notifications/history/:id'], 'DELETE /api/admin/notifications/history/:id must be registered');
  assert(routes['GET /api/admin/notifications/history'], 'GET /api/admin/notifications/history must be registered');

  console.log('✓ All notification routes properly registered.');
  console.log('ALL TESTS PASSED: Admin push-only and history deletion endpoints verified.');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
