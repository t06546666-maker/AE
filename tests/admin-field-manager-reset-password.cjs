const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

// 1. Verify server.js route & logic
const server = fs.readFileSync('server.js', 'utf8').replace(/\r\n/g, '\n');

const routeStart = server.indexOf("app.post('/api/admin/field-managers/:id/reset-password'");
assert.ok(routeStart >= 0, 'POST /api/admin/field-managers/:id/reset-password route exists in server.js');

const routeEnd = server.indexOf("app.delete('/api/admin/field-managers/:id'", routeStart);
assert.ok(routeEnd > routeStart, 'Route boundaries defined');
const routeCode = server.slice(routeStart, routeEnd);

// Route must require auth and admin role
assert.ok(routeCode.includes("requireAuth"), 'Requires authentication');
assert.ok(routeCode.includes("requireRole('admin')"), 'Requires admin role');

// Route must validate UUID
assert.ok(routeCode.includes("uuidRegex.test(managerId)"), 'Validates managerId UUID');

// Route must check profile with role = field_manager
assert.ok(routeCode.includes(".eq('role', 'field_manager')"), 'Verifies profile role is field_manager');

// Route must update auth password
assert.ok(routeCode.includes("supabaseAdmin.auth.admin.updateUserById"), 'Updates user password in auth');

// Route must set must_change_password = true and password_reset_at
assert.ok(routeCode.includes("must_change_password: true"), 'Sets must_change_password to true');
assert.ok(routeCode.includes("password_reset_at: resetAt"), 'Sets password_reset_at');

// Route must return loginEmail, temporaryPassword, mustChangePassword
assert.ok(routeCode.includes("loginEmail: authUser.user.email"), 'Returns login email');
assert.ok(routeCode.includes("temporaryPassword"), 'Returns temporary password');
assert.ok(routeCode.includes("mustChangePassword: true"), 'Returns mustChangePassword flag');

// Test handler logic in isolation using vm sandbox
let handler;
const authMock = () => {};
const adminRoleMock = () => {};

let mockProfile = { id: '11111111-1111-4111-8111-111111111111', full_name: 'Test Field Manager', role: 'field_manager' };
let mockAuthUser = { user: { id: '11111111-1111-4111-8111-111111111111', email: 'manager@example.com' } };
let updatedAuthPassword = null;
let updatedProfileFields = null;

const fakeSupabaseAdmin = {
  from(table) {
    assert.equal(table, 'profiles');
    return {
      select(cols) {
        return {
          eq(col1, val1) {
            return {
              eq(col2, val2) {
                return {
                  async maybeSingle() {
                    if (val1 === mockProfile.id && val2 === 'field_manager') {
                      return { data: mockProfile, error: null };
                    }
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      },
      update(fields) {
        updatedProfileFields = fields;
        return {
          eq(col, val) {
            assert.equal(col, 'id');
            assert.equal(val, mockProfile.id);
            return Promise.resolve({ error: null });
          }
        };
      }
    };
  },
  auth: {
    admin: {
      async getUserById(id) {
        if (id === mockProfile.id) return { data: mockAuthUser, error: null };
        return { data: null, error: { message: 'User not found' } };
      },
      async updateUserById(id, payload) {
        assert.equal(id, mockProfile.id);
        updatedAuthPassword = payload.password;
        return { error: null };
      }
    }
  }
};

const context = {
  cleanText: (val) => String(val || '').trim(),
  generateTemporaryPassword: () => 'Aa1!mockTempPassword123',
  isStrongPassword: (pwd) => typeof pwd === 'string' && pwd.length >= 8 && /[A-Z]/.test(pwd),
  requireAuth: authMock,
  requireRole: (role) => {
    assert.equal(role, 'admin');
    return adminRoleMock;
  },
  app: {
    post(path, ...handlers) {
      assert.equal(path, '/api/admin/field-managers/:id/reset-password');
      assert.equal(handlers[0], authMock);
      assert.equal(handlers[1], adminRoleMock);
      handler = handlers.at(-1);
    }
  },
  supabaseAdmin: fakeSupabaseAdmin,
};

vm.runInNewContext(routeCode, context);
assert.equal(typeof handler, 'function', 'Handler successfully registered');

const createRes = () => ({
  statusCode: 200,
  status(n) { this.statusCode = n; return this; },
  json(body) { this.body = body; return this; }
});

(async () => {
  // Test invalid manager ID
  let res = createRes();
  await handler({ params: { id: 'invalid-id' }, body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid manager ID');

  // Test manager not found
  res = createRes();
  await handler({ params: { id: '00000000-0000-0000-0000-000000000000' }, body: {} }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, 'Field manager not found');

  // Test weak custom password
  res = createRes();
  await handler({ params: { id: mockProfile.id }, body: { password: 'weak' } }, res);
  assert.equal(res.statusCode, 400);
  assert.ok(res.body.error.includes('security requirements'));

  // Test successful reset with auto-generated temporary password
  res = createRes();
  await handler({ params: { id: mockProfile.id }, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.managerId, mockProfile.id);
  assert.equal(res.body.fullName, 'Test Field Manager');
  assert.equal(res.body.loginEmail, 'manager@example.com');
  assert.equal(res.body.temporaryPassword, 'Aa1!mockTempPassword123');
  assert.equal(res.body.mustChangePassword, true);
  assert.equal(updatedAuthPassword, 'Aa1!mockTempPassword123');
  assert.equal(updatedProfileFields.must_change_password, true);
  assert.ok(updatedProfileFields.password_reset_at);

  // 2. Verify Frontend Component and Integrations
  const componentCode = fs.readFileSync('src/components/AdminResetFieldManagerPassword.tsx', 'utf8');
  assert.ok(componentCode.includes('export function AdminResetFieldManagerPassword'), 'AdminResetFieldManagerPassword component exported');
  assert.ok(componentCode.includes('/api/admin/field-managers/${encodeURIComponent(id)}/reset-password'), 'Calls reset-password endpoint');
  assert.ok(componentCode.includes('credentials-modal'), 'Renders credentials-modal on success');
  assert.ok(componentCode.includes('temporaryPassword'), 'Displays temporary password');
  assert.ok(componentCode.includes('loginEmail'), 'Displays login email');

  const fieldManagersPage = fs.readFileSync('src/pages/FieldManagers.tsx', 'utf8');
  assert.ok(fieldManagersPage.includes('AdminResetFieldManagerPassword'), 'FieldManagers imports AdminResetFieldManagerPassword');
  assert.ok(fieldManagersPage.includes('<AdminResetFieldManagerPassword id={m.id} name={m.full_name} variant="icon" />'), 'FieldManagers renders AdminResetFieldManagerPassword in table row');

  const fieldDetailsComponent = fs.readFileSync('src/components/AdminFieldDetails.tsx', 'utf8');
  assert.ok(fieldDetailsComponent.includes('AdminResetFieldManagerPassword'), 'AdminFieldDetails imports AdminResetFieldManagerPassword');
  assert.ok(fieldDetailsComponent.includes('<AdminResetFieldManagerPassword id={id} name={profile.full_name || \'Field Manager\'} email={profile.email} />'), 'AdminFieldDetails renders AdminResetFieldManagerPassword in actions header');

  console.log('ALL TESTS PASSED: Field Manager password reset endpoint and admin UI verified successfully.');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

