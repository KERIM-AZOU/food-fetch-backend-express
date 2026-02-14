const BASE = 'http://localhost:5006/api';
const rand = () => Math.random().toString(36).slice(2, 8);

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

// ── Setup: create admin + regular user ────────────────────────────────

const adminEmail = `admin_${rand()}@example.com`;
const userEmail = `user_${rand()}@example.com`;
const password = 'TestP@ss123';
let adminToken, userToken, userId;

console.log('\n── Admin Endpoint Tests ─────────────────────────────\n');

// Register admin
const { data: adminReg } = await req('POST', '/auth/register', { email: adminEmail, password, name: 'Admin' });
adminToken = adminReg.token;

// We need to make this user an admin directly in DB. Use a helper endpoint workaround:
// Actually, we'll use mongoose directly via a quick script. But since we can't import in this test,
// let's register, then use the admin's own update endpoint after promoting via DB.
// For testing, we'll promote via a direct MongoDB update.

import mongoose from 'mongoose';
await mongoose.connect(process.env.MONGO_URI || 'mongodb://root:secret@localhost:27017/foodfetch?authSource=admin');
await mongoose.connection.collection('users').updateOne(
  { email: adminEmail },
  { $set: { role: 'ADMIN' } },
);

// Re-login to get token with ADMIN role in JWT
const { data: adminLogin } = await req('POST', '/auth/login', { email: adminEmail, password });
adminToken = adminLogin.token;

// Register regular user
const { data: userReg } = await req('POST', '/auth/register', { email: userEmail, password, name: 'Regular User' });
userToken = userReg.token;
userId = userReg.user.id;

console.log(`  [setup] Admin: ${adminEmail}`);
console.log(`  [setup] User: ${userEmail}\n`);

// ── Access control ───────────────────────────────────────────────────

await test('Regular user cannot access admin routes → 403', async () => {
  const { status } = await req('GET', '/admin/users', null, userToken);
  assert(status === 403, `Expected 403 got ${status}`);
});

await test('Unauthenticated cannot access admin routes → 401', async () => {
  const { status } = await req('GET', '/admin/users');
  assert(status === 401, `Expected 401 got ${status}`);
});

// ── User management ──────────────────────────────────────────────────

await test('GET /admin/users lists users', async () => {
  const { status, data } = await req('GET', '/admin/users', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.users), 'Expected users array');
  assert(data.total >= 2, `Should have at least 2 users, got ${data.total}`);
  assert(data.pages >= 1, 'Should have pages');
});

await test('GET /admin/users with search filter', async () => {
  const { status, data } = await req('GET', `/admin/users?search=${encodeURIComponent(userEmail)}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.users.length === 1, `Expected 1 user got ${data.users.length}`);
});

await test('GET /admin/users with role filter', async () => {
  const { status, data } = await req('GET', '/admin/users?role=ADMIN', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.users.every(u => u.role === 'ADMIN'), 'All should be admin');
});

await test('GET /admin/users/:id returns user', async () => {
  const { status, data } = await req('GET', `/admin/users/${userId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.email === userEmail, 'Email mismatch');
});

await test('PATCH /admin/users/:id updates user', async () => {
  const { status, data } = await req('PATCH', `/admin/users/${userId}`, { isVerified: true }, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.isVerified === true, 'Should be verified');
});

await test('GET /admin/users/:id 404 for invalid id', async () => {
  const { status } = await req('GET', '/admin/users/000000000000000000000000', null, adminToken);
  assert(status === 404, `Expected 404 got ${status}`);
});

// ── Analytics ────────────────────────────────────────────────────────

await test('GET /admin/analytics/overview', async () => {
  const { status, data } = await req('GET', '/admin/analytics/overview', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data.totalUsers === 'number', 'Missing totalUsers');
  assert(typeof data.totalSearches === 'number', 'Missing totalSearches');
});

await test('GET /admin/analytics/searches', async () => {
  const { status, data } = await req('GET', '/admin/analytics/searches', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data.totalSearches === 'number', 'Missing totalSearches');
});

await test('GET /admin/analytics/platforms', async () => {
  const { status, data } = await req('GET', '/admin/analytics/platforms', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/analytics/popular-items', async () => {
  const { status, data } = await req('GET', '/admin/analytics/popular-items', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/analytics/activity', async () => {
  const { status, data } = await req('GET', '/admin/analytics/activity', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data.activeUsers === 'number', 'Missing activeUsers');
});

await test('GET /admin/analytics/geo', async () => {
  const { status, data } = await req('GET', '/admin/analytics/geo', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.countrySplit, 'Missing countrySplit');
});

await test('GET /admin/analytics/time', async () => {
  const { status, data } = await req('GET', '/admin/analytics/time', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.timeline), 'Missing timeline');
  assert(Array.isArray(data.peakHours), 'Missing peakHours');
});

// ── Token analytics ──────────────────────────────────────────────────

await test('GET /admin/analytics/tokens', async () => {
  const { status, data } = await req('GET', '/admin/analytics/tokens', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/analytics/tokens/timeline', async () => {
  const { status, data } = await req('GET', '/admin/analytics/tokens/timeline?granularity=daily', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/analytics/tokens/costs', async () => {
  const { status, data } = await req('GET', '/admin/analytics/tokens/costs', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/users/:id/tokens', async () => {
  const { status, data } = await req('GET', `/admin/users/${userId}/tokens`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.records), 'Expected records array');
});

await test('GET /admin/users/:id/tokens/summary', async () => {
  const { status, data } = await req('GET', `/admin/users/${userId}/tokens/summary`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

await test('GET /admin/users/:id/tokens/timeline', async () => {
  const { status, data } = await req('GET', `/admin/users/${userId}/tokens/timeline`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

// ── Marketer CRUD ────────────────────────────────────────────────────

let marketerId;

await test('POST /admin/marketers creates marketer', async () => {
  const { status, data } = await req('POST', '/admin/marketers', {
    name: 'Ahmed', code: `TEST${rand()}`,
  }, adminToken);
  assert(status === 201, `Expected 201 got ${status}: ${JSON.stringify(data)}`);
  assert(data.name === 'Ahmed', 'Name mismatch');
  marketerId = data._id;
});

await test('POST /admin/marketers duplicate code → 409', async () => {
  const marketer = await req('GET', `/admin/marketers/${marketerId}`, null, adminToken);
  const { status } = await req('POST', '/admin/marketers', {
    name: 'Dup', code: marketer.data.code,
  }, adminToken);
  assert(status === 409, `Expected 409 got ${status}`);
});

await test('GET /admin/marketers lists all', async () => {
  const { status, data } = await req('GET', '/admin/marketers', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.marketers), 'Expected marketers array');
});

await test('GET /admin/marketers/:id', async () => {
  const { status, data } = await req('GET', `/admin/marketers/${marketerId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.name === 'Ahmed', 'Name mismatch');
});

await test('PATCH /admin/marketers/:id updates', async () => {
  const { status, data } = await req('PATCH', `/admin/marketers/${marketerId}`, { name: 'Ahmed Updated' }, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.name === 'Ahmed Updated', 'Name not updated');
});

await test('DELETE /admin/marketers/:id deactivates', async () => {
  const { status, data } = await req('DELETE', `/admin/marketers/${marketerId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.isActive === false, 'Should be deactivated');
});

await test('GET /admin/marketers/:id/redemptions', async () => {
  const { status, data } = await req('GET', `/admin/marketers/${marketerId}/redemptions`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.redemptions), 'Expected redemptions array');
});

// ── Marketer analytics ───────────────────────────────────────────────

await test('GET /admin/analytics/marketers', async () => {
  const { status, data } = await req('GET', '/admin/analytics/marketers', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data.totalSignups === 'number', 'Missing totalSignups');
});

await test('GET /admin/analytics/marketers/:id', async () => {
  const { status, data } = await req('GET', `/admin/analytics/marketers/${marketerId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
});

// ── Exports ──────────────────────────────────────────────────────────

await test('GET /admin/export/searches returns CSV', async () => {
  const { status, data } = await req('GET', '/admin/export/searches', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data === 'string', 'Expected CSV string');
  assert(data.includes('id,'), 'Should have CSV headers');
});

await test('GET /admin/export/users returns CSV', async () => {
  const { status, data } = await req('GET', '/admin/export/users', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data === 'string' && data.includes('email'), 'Should have email header');
});

await test('GET /admin/export/tokens returns CSV', async () => {
  const { status, data } = await req('GET', '/admin/export/tokens', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data === 'string' && data.includes('service'), 'Should have service header');
});

await test('GET /admin/export/marketers returns CSV', async () => {
  const { status, data } = await req('GET', '/admin/export/marketers', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(typeof data === 'string' && data.includes('code'), 'Should have code header');
});

// ── Delete user ──────────────────────────────────────────────────────

await test('DELETE /admin/users/:id deletes user', async () => {
  // Create a throwaway user
  const tmpEmail = `tmp_${rand()}@example.com`;
  const { data: tmpReg } = await req('POST', '/auth/register', { email: tmpEmail, password });
  const tmpId = tmpReg.user.id;

  const { status } = await req('DELETE', `/admin/users/${tmpId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);

  // Verify deleted
  const { status: s2 } = await req('GET', `/admin/users/${tmpId}`, null, adminToken);
  assert(s2 === 404, `Expected 404 got ${s2}`);
});

// Cleanup
await mongoose.disconnect();

// Summary
console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────\n`);
process.exit(failed > 0 ? 1 : 0);
