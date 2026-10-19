const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createProfileNotificationInbox } = require('../backend/profile-notification-inbox.cjs');

const stores = new Map();
let nextId = 0;
const database = {
  collection(name) {
    assert.equal(name, 'ae_profile_notification_inboxes');
    return { doc(profileId) { return { collection(child) {
      assert.equal(child, 'items');
      if (!stores.has(profileId)) stores.set(profileId, new Map());
      const store = stores.get(profileId);
      return {
        async add(data) { const id = `notice${++nextId}`; store.set(id, { ...data }); return { id }; },
        orderBy(field, direction) {
          assert.equal(field, 'created_at'); assert.equal(direction, 'desc');
          return { limit(limit) { return { async get() {
            return { docs: [...store].sort((a, b) => b[1].created_at.localeCompare(a[1].created_at)).slice(0, limit).map(([id, row]) => ({ id, data: () => ({ ...row }) })) };
          } }; } };
        },
        where(field, op, value) {
          assert.equal(field, 'read_at'); assert.equal(op, '=='); assert.equal(value, null);
          return { count() { return { async get() { return { data: () => ({ count: [...store.values()].filter(row => row.read_at === null).length }) }; } }; } };
        },
        doc(id) { return {
          async get() { return { exists: store.has(id), data: () => ({ ...store.get(id) }) }; },
          async update(data) { assert(store.has(id)); store.set(id, { ...store.get(id), ...data }); },
        }; },
      };
    } }; } };
  },
};

(async () => {
  const inbox = createProfileNotificationInbox(async () => database);
  const first = await inbox.save('profile-a', 'A'.repeat(200), 'Body', { url: '/orders?requestId=demo', type: 'checkout', requestId: 'request-a' });
  await inbox.save('profile-a', 'Other', 'Body', { url: '//external.invalid' });
  await inbox.save('profile-b', 'Private B', 'Body');
  let result = await inbox.list('profile-a', 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.unreadCount, 2, 'unread count must include items outside the displayed page');
  assert.equal(await inbox.markRead('profile-b', first), false, 'another profile cannot mark the owner\'s notification read');
  assert.equal(await inbox.markRead('profile-a', first), true);
  const readAt = stores.get('profile-a').get('notice1').read_at;
  assert.equal(await inbox.markRead('profile-a', first), true);
  assert.equal(stores.get('profile-a').get('notice1').read_at, readAt, 'read is idempotent');
  result = await inbox.list('profile-a', 999);
  assert.equal(result.unreadCount, 1);
  const firstItem = result.items.find(item => item.id === first);
  assert.equal(firstItem.title.length, 160);
  assert.equal(firstItem.entity_id, 'request-a');
  assert.equal(stores.get('profile-a').get('notice2').target_url, null);
  assert.equal(await inbox.markRead('profile-a', 'firebase:../profile-b'), false);
  assert.equal(await inbox.markRead('profile-a', 'legacy-id'), false);
  await assert.rejects(inbox.list('../profile-b'), /Invalid notification profile/);
  const failingInbox = createProfileNotificationInbox(async () => { throw Error('offline'); });
  await assert.rejects(failingInbox.list('profile-a'), /offline/);

  const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'server.js'), 'utf8');
  assert(!source.includes("from('app_notifications')"), 'the Supabase inbox migration must not be required');
  const routes = {};
  const sandbox = {
    app: { get: (path, auth, handler) => { routes[path] = handler; }, post: (path, auth, handler) => { routes[path] = handler; } },
    requireAuth() {}, profileNotificationInbox: inbox, console,
    supabaseAdmin: { from() { throw Error('Admin Firestore inbox must not query Supabase'); } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(source.indexOf("app.get('/api/notifications',"), source.indexOf("app.get('/api/offers',")), sandbox);
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  let res = response();
  await routes['/api/notifications']({ query: { limit: 1 }, auth: { profile: { id: 'profile-a', role: 'admin' } } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.notifications.length, 1); assert.equal(res.body.unreadCount, 1);
  sandbox.supabaseAdmin = { from(name) {
    assert.equal(name, 'merchant_notifications', 'only historical records may use Supabase');
    return { select() { return this; }, eq(field, value) {
      assert.equal(field, 'merchant_id'); assert.equal(value, 'merchant-a'); return this;
    }, order() { return this; }, async limit() { return { data: [] }; } };
  } };
  sandbox.checkoutBillDatabase = async () => ({ collection(name) {
    assert.equal(name, 'ae_sales_targets');
    return { where(field, op, id) {
      assert.equal(field, 'merchantId'); assert.equal(op, '=='); assert.equal(id, 'merchant-a');
      return { async get() { return { docs: [] }; } };
    } };
  } });
  res = response();
  await routes['/api/notifications']({ query: {}, auth: { profile: { id: 'profile-a', role: 'merchant', merchant_id: 'merchant-a' } } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.notifications.length, 2); assert.equal(res.body.unreadCount, 1);
  res = response();
  await routes['/api/notifications/:id/read']({ params: { id: first }, auth: { profile: { id: 'profile-b', role: 'admin' } } }, res);
  assert.equal(res.code, 404);
  sandbox.profileNotificationInbox = failingInbox;
  res = response();
  await routes['/api/notifications']({ query: {}, auth: { profile: { id: 'profile-a', role: 'admin' } } }, res);
  assert.equal(res.code, 503, 'do not disguise Firebase failures as an empty successful inbox');
  console.log('PASS: Firestore inbox save/list/read, authenticated profile isolation, pagination, unread counts, idempotency, safe links and unavailable-service responses.');
})().catch(error => { console.error(error); process.exitCode = 1; });
