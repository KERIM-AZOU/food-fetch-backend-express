/**
 * Comprehensive API test suite for Food Finder V2.
 *
 * Usage:
 *   node test-all.mjs
 *
 * Requires:
 *   - Server running on http://localhost:5006
 *   - MongoDB running with connectivity
 *   - mongoose package (for admin setup)
 */

import mongoose from 'mongoose';

const BASE = 'http://localhost:5006';
const API = `${BASE}/api`;
const rand = () => Math.random().toString(36).slice(2, 8);

let passed = 0;
let failed = 0;
let skipped = 0;
const sections = [];

// ── Helpers ──────────────────────────────────────────────────────────

async function test(name, fn) {
  try {
    await fn();
    console.log(`    ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`    ✗ ${name}`);
    console.log(`      ${err.message}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`    - ${name} (skipped: ${reason})`);
  skipped++;
}

function section(name) {
  console.log(`\n  ── ${name} ──`);
  sections.push(name);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

async function rawFetch(method, url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.text();
  return { status: res.status, data };
}

// ══════════════════════════════════════════════════════════════════════
//  Setup
// ══════════════════════════════════════════════════════════════════════

console.log('\n══ Food Finder V2 — Full Test Suite ══════════════════\n');

// Connect to MongoDB for admin setup
await mongoose.connect(process.env.MONGO_URI || 'mongodb://root:secret@localhost:27017/foodfetch?authSource=admin');

const adminEmail = `admin_${rand()}@test.com`;
const userEmail = `user_${rand()}@test.com`;
const user2Email = `user2_${rand()}@test.com`;
const password = 'TestP@ss123';
let adminToken, userToken, user2Token, userId, user2Id;

// ══════════════════════════════════════════════════════════════════════
//  1. Health Check
// ══════════════════════════════════════════════════════════════════════

section('Health Check');

await test('GET /health returns healthy', async () => {
  const { status, data } = await rawFetch('GET', `${BASE}/health`);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.status === 'healthy', 'Not healthy');
});

// ══════════════════════════════════════════════════════════════════════
//  2. Auth Routes — /api/auth
// ══════════════════════════════════════════════════════════════════════

section('Auth — Register');

await test('POST /auth/register creates user', async () => {
  const { status, data } = await req('POST', '/auth/register', { email: userEmail, password, name: 'Test User' });
  assert(status === 201, `Expected 201 got ${status}: ${JSON.stringify(data)}`);
  assert(data.token, 'Missing token');
  assert(data.user?.id, 'Missing user.id');
  assert(data.user.email === userEmail, 'Email mismatch');
  userToken = data.token;
  userId = data.user.id;
});

await test('POST /auth/register second user', async () => {
  const { status, data } = await req('POST', '/auth/register', { email: user2Email, password, name: 'User Two' });
  assert(status === 201, `Expected 201 got ${status}`);
  user2Token = data.token;
  user2Id = data.user.id;
});

await test('POST /auth/register admin user', async () => {
  const { status, data } = await req('POST', '/auth/register', { email: adminEmail, password, name: 'Admin' });
  assert(status === 201, `Expected 201 got ${status}`);
  // Promote to admin directly in DB
  await mongoose.connection.collection('users').updateOne({ email: adminEmail }, { $set: { role: 'ADMIN' } });
  // Re-login for admin token with ADMIN role in JWT
  const { data: loginData } = await req('POST', '/auth/login', { email: adminEmail, password });
  adminToken = loginData.token;
});

await test('POST /auth/register duplicate email → 409', async () => {
  const { status } = await req('POST', '/auth/register', { email: userEmail, password });
  assert(status === 409, `Expected 409 got ${status}`);
});

await test('POST /auth/register missing fields → 400', async () => {
  const { status } = await req('POST', '/auth/register', { email: 'x@x.com' });
  assert(status === 400, `Expected 400 got ${status}`);
});

await test('POST /auth/register invalid voucher → 400', async () => {
  const { status } = await req('POST', '/auth/register', {
    email: `v_${rand()}@test.com`, password, voucherCode: 'BADCODE',
  });
  assert(status === 400, `Expected 400 got ${status}`);
});

section('Auth — Login');

await test('POST /auth/login valid credentials', async () => {
  const { status, data } = await req('POST', '/auth/login', { email: userEmail, password });
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.token, 'Missing token');
  assert(data.user.email === userEmail, 'Email mismatch');
});

await test('POST /auth/login wrong password → 401', async () => {
  const { status } = await req('POST', '/auth/login', { email: userEmail, password: 'wrong' });
  assert(status === 401, `Expected 401 got ${status}`);
});

await test('POST /auth/login non-existent email → 401', async () => {
  const { status } = await req('POST', '/auth/login', { email: 'ghost@test.com', password: 'x' });
  assert(status === 401, `Expected 401 got ${status}`);
});

section('Auth — Logout');

await test('POST /auth/logout invalidates token', async () => {
  const { data: d } = await req('POST', '/auth/login', { email: userEmail, password });
  const tmpToken = d.token;
  const { status } = await req('POST', '/auth/logout', {}, tmpToken);
  assert(status === 200, `Expected 200 got ${status}`);
  const { status: s2 } = await req('POST', '/auth/logout', {}, tmpToken);
  assert(s2 === 401, `Token should be revoked, got ${s2}`);
});

await test('POST /auth/logout without token → 401', async () => {
  const { status } = await req('POST', '/auth/logout', {});
  assert(status === 401, `Expected 401 got ${status}`);
});

await test('POST /auth/logout-all invalidates all sessions', async () => {
  const { data: d1 } = await req('POST', '/auth/login', { email: userEmail, password });
  const { data: d2 } = await req('POST', '/auth/login', { email: userEmail, password });
  const { status } = await req('POST', '/auth/logout-all', {}, d1.token);
  assert(status === 200, `Expected 200 got ${status}`);
  const { status: s1 } = await req('POST', '/auth/logout', {}, d1.token);
  const { status: s2 } = await req('POST', '/auth/logout', {}, d2.token);
  assert(s1 === 401, `tok1 should be revoked`);
  assert(s2 === 401, `tok2 should be revoked`);
  // Re-login for continued tests
  const { data: fresh } = await req('POST', '/auth/login', { email: userEmail, password });
  userToken = fresh.token;
});

section('Auth — Password Reset');

await test('POST /auth/forgot-password returns 200', async () => {
  const { status } = await req('POST', '/auth/forgot-password', { email: userEmail });
  assert(status === 200, `Expected 200 got ${status}`);
});

await test('POST /auth/forgot-password non-existent → 200 (no leak)', async () => {
  const { status } = await req('POST', '/auth/forgot-password', { email: 'ghost@test.com' });
  assert(status === 200, `Expected 200 got ${status}`);
});

await test('POST /auth/reset-password invalid token → 400', async () => {
  const { status } = await req('POST', '/auth/reset-password', { token: 'bad', newPassword: 'New123!' });
  assert(status === 400, `Expected 400 got ${status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  3. User Routes — /api/users
// ══════════════════════════════════════════════════════════════════════

section('Users — Profile');

await test('GET /users/me returns profile', async () => {
  const { status, data } = await req('GET', '/users/me', null, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.email === userEmail, 'Email mismatch');
  assert(!data.password, 'Password should not be exposed');
});

await test('GET /users/me without token → 401', async () => {
  const { status } = await req('GET', '/users/me');
  assert(status === 401, `Expected 401 got ${status}`);
});

await test('PATCH /users/me updates name', async () => {
  const { status, data } = await req('PATCH', '/users/me', { name: 'Updated' }, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.name === 'Updated', 'Name not updated');
});

await test('PATCH /users/me updates preferences', async () => {
  const { status, data } = await req('PATCH', '/users/me', {
    preferences: { language: 'ar', country: 'QA', theme: 'dark' },
  }, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.preferences.language === 'ar', 'Preferences not updated');
});

await test('PATCH /users/me ignores role/email escalation', async () => {
  const { status, data } = await req('PATCH', '/users/me', { role: 'ADMIN', email: 'hack@x.com' }, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.role === 'USER', 'Role should not change');
  assert(data.email === userEmail, 'Email should not change');
});

await test('PATCH /users/me/password changes password', async () => {
  const newPw = 'NewPass456!';
  const { status } = await req('PATCH', '/users/me/password', {
    currentPassword: password, newPassword: newPw,
  }, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  // Old token should be revoked
  const { status: s2 } = await req('GET', '/users/me', null, userToken);
  assert(s2 === 401, `Old token should be revoked`);
  // Login with new pw, then change back
  const { data: d1 } = await req('POST', '/auth/login', { email: userEmail, password: newPw });
  userToken = d1.token;
  await req('PATCH', '/users/me/password', { currentPassword: newPw, newPassword: password }, userToken);
  const { data: d2 } = await req('POST', '/auth/login', { email: userEmail, password });
  userToken = d2.token;
});

await test('PATCH /users/me/password wrong current → 401', async () => {
  const { status } = await req('PATCH', '/users/me/password', {
    currentPassword: 'wrong', newPassword: 'x',
  }, userToken);
  assert(status === 401, `Expected 401 got ${status}`);
});

section('Users — Saved Locations');

let locId;

await test('POST /users/me/locations creates location', async () => {
  const { status, data } = await req('POST', '/users/me/locations', {
    label: 'Home', lat: 25.286, lon: 51.534, country: 'QA', address: '123 St',
  }, userToken);
  assert(status === 201, `Expected 201 got ${status}`);
  assert(data.label === 'Home', 'Label mismatch');
  locId = data._id;
});

await test('POST /users/me/locations missing fields → 400', async () => {
  const { status } = await req('POST', '/users/me/locations', { label: 'X' }, userToken);
  assert(status === 400, `Expected 400 got ${status}`);
});

await test('GET /users/me/locations lists locations', async () => {
  const { status, data } = await req('GET', '/users/me/locations', null, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data) && data.length >= 1, 'Expected at least 1 location');
});

await test('PATCH /users/me/locations/:id updates', async () => {
  const { status, data } = await req('PATCH', `/users/me/locations/${locId}`, { label: 'Office' }, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.label === 'Office', 'Label not updated');
});

await test('PATCH /users/me/locations/:id/default sets default', async () => {
  const { status, data } = await req('PATCH', `/users/me/locations/${locId}/default`, {}, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.isDefault === true, 'Should be default');
});

await test('Second location as default unsets first', async () => {
  const { data: loc2 } = await req('POST', '/users/me/locations', {
    label: 'Work', lat: 25.3, lon: 51.5, country: 'QA', isDefault: true,
  }, userToken);
  const { data: all } = await req('GET', '/users/me/locations', null, userToken);
  const first = all.find(l => l._id === locId);
  const second = all.find(l => l._id === loc2._id);
  assert(first.isDefault === false, 'First should no longer be default');
  assert(second.isDefault === true, 'Second should be default');
});

await test('DELETE /users/me/locations/:id removes location', async () => {
  const { status } = await req('DELETE', `/users/me/locations/${locId}`, null, userToken);
  assert(status === 200, `Expected 200 got ${status}`);
});

await test('DELETE non-existent location → 404', async () => {
  const { status } = await req('DELETE', '/users/me/locations/000000000000000000000000', null, userToken);
  assert(status === 404, `Expected 404 got ${status}`);
});

// ══════════════════════════════════════════════════════════════════════
//  4. Admin Routes — /api/admin
// ══════════════════════════════════════════════════════════════════════

section('Admin — Access Control');

await test('Regular user → 403', async () => {
  const { status } = await req('GET', '/admin/users', null, userToken);
  assert(status === 403, `Expected 403 got ${status}`);
});

await test('No token → 401', async () => {
  const { status } = await req('GET', '/admin/users');
  assert(status === 401, `Expected 401 got ${status}`);
});

section('Admin — User Management');

await test('GET /admin/users paginated list', async () => {
  const { status, data } = await req('GET', '/admin/users', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data.users), 'Expected users array');
  assert(data.total >= 3, 'Should have at least 3 users');
  assert(data.pages >= 1, 'Missing pages');
});

await test('GET /admin/users?search=... filters', async () => {
  const { status, data } = await req('GET', `/admin/users?search=${encodeURIComponent(userEmail)}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.users.length === 1, `Expected 1 got ${data.users.length}`);
});

await test('GET /admin/users?role=ADMIN filters', async () => {
  const { status, data } = await req('GET', '/admin/users?role=ADMIN', null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.users.every(u => u.role === 'ADMIN'), 'Should all be admin');
});

await test('GET /admin/users/:id returns user', async () => {
  const { status, data } = await req('GET', `/admin/users/${userId}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.email === userEmail, 'Email mismatch');
});

await test('PATCH /admin/users/:id updates', async () => {
  const { status, data } = await req('PATCH', `/admin/users/${userId}`, { isVerified: true }, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.isVerified === true, 'Should be verified');
});

await test('GET /admin/users/:id 404 for bad id', async () => {
  const { status } = await req('GET', '/admin/users/000000000000000000000000', null, adminToken);
  assert(status === 404, `Expected 404 got ${status}`);
});

await test('DELETE /admin/users/:id deletes user', async () => {
  const { data: tmp } = await req('POST', '/auth/register', { email: `del_${rand()}@test.com`, password });
  const { status } = await req('DELETE', `/admin/users/${tmp.user.id}`, null, adminToken);
  assert(status === 200, `Expected 200 got ${status}`);
  const { status: s2 } = await req('GET', `/admin/users/${tmp.user.id}`, null, adminToken);
  assert(s2 === 404, 'User should be gone');
});

section('Admin — Analytics');

const analyticsEndpoints = [
  '/admin/analytics/overview',
  '/admin/analytics/searches',
  '/admin/analytics/platforms',
  '/admin/analytics/popular-items',
  '/admin/analytics/activity',
  '/admin/analytics/geo',
  '/admin/analytics/time',
  '/admin/analytics/tokens',
  '/admin/analytics/tokens/timeline?granularity=daily',
  '/admin/analytics/tokens/costs',
  `/admin/users/${userId}/tokens`,
  `/admin/users/${userId}/tokens/summary`,
  `/admin/users/${userId}/tokens/timeline`,
];

for (const ep of analyticsEndpoints) {
  await test(`GET ${ep}`, async () => {
    const { status } = await req('GET', ep, null, adminToken);
    assert(status === 200, `Expected 200 got ${status}`);
  });
}

section('Admin — Marketer CRUD');

let marketerId;
const marketerCode = `MKT${rand().toUpperCase()}`;

await test('POST /admin/marketers creates', async () => {
  const { status, data } = await req('POST', '/admin/marketers', { name: 'Ahmed', code: marketerCode }, adminToken);
  assert(status === 201, `Expected 201 got ${status}`);
  assert(data.name === 'Ahmed', 'Name mismatch');
  assert(data.code === marketerCode.toUpperCase(), 'Code mismatch');
  marketerId = data._id;
});

await test('POST /admin/marketers duplicate → 409', async () => {
  const { status } = await req('POST', '/admin/marketers', { name: 'Dup', code: marketerCode }, adminToken);
  assert(status === 409, `Expected 409 got ${status}`);
});

await test('GET /admin/marketers lists', async () => {
  const { status, data } = await req('GET', '/admin/marketers', null, adminToken);
  assert(status === 200 && Array.isArray(data.marketers), 'Expected marketers array');
});

await test('GET /admin/marketers/:id', async () => {
  const { status, data } = await req('GET', `/admin/marketers/${marketerId}`, null, adminToken);
  assert(status === 200 && data.name === 'Ahmed', 'Marketer mismatch');
});

await test('PATCH /admin/marketers/:id updates', async () => {
  const { status, data } = await req('PATCH', `/admin/marketers/${marketerId}`, { name: 'Ahmed V2' }, adminToken);
  assert(status === 200 && data.name === 'Ahmed V2', 'Not updated');
});

await test('DELETE /admin/marketers/:id deactivates', async () => {
  const { status, data } = await req('DELETE', `/admin/marketers/${marketerId}`, null, adminToken);
  assert(status === 200 && data.isActive === false, 'Should be deactivated');
});

await test('GET /admin/marketers/:id/redemptions', async () => {
  const { status, data } = await req('GET', `/admin/marketers/${marketerId}/redemptions`, null, adminToken);
  assert(status === 200 && Array.isArray(data.redemptions), 'Expected redemptions');
});

section('Admin — Marketer Analytics');

await test('GET /admin/analytics/marketers', async () => {
  const { status, data } = await req('GET', '/admin/analytics/marketers', null, adminToken);
  assert(status === 200 && typeof data.totalSignups === 'number', 'Missing totalSignups');
});

await test('GET /admin/analytics/marketers/:id', async () => {
  const { status, data } = await req('GET', `/admin/analytics/marketers/${marketerId}`, null, adminToken);
  assert(status === 200 && Array.isArray(data), 'Expected array');
});

section('Admin — CSV Exports');

const exportEndpoints = [
  { path: '/admin/export/searches', header: 'id' },
  { path: '/admin/export/users', header: 'email' },
  { path: '/admin/export/tokens', header: 'service' },
  { path: '/admin/export/marketers', header: 'code' },
];

for (const { path, header } of exportEndpoints) {
  await test(`GET ${path} returns CSV`, async () => {
    const { status, data } = await req('GET', path, null, adminToken);
    assert(status === 200, `Expected 200 got ${status}`);
    assert(typeof data === 'string' && data.includes(header), `Missing ${header} header`);
  });
}

// ══════════════════════════════════════════════════════════════════════
//  5. Existing Service Routes (require API keys)
// ══════════════════════════════════════════════════════════════════════

section('Existing Routes — Validation Only');

await test('POST /search missing term → 400', async () => {
  const { status } = await req('POST', '/search', { lat: 25.2, lon: 51.5 });
  assert(status === 400, `Expected 400 got ${status}`);
});

await test('GET /translate/languages returns list', async () => {
  const { status, data } = await req('GET', '/translate/languages');
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.languages && data.languages.length > 0, 'Expected languages list');
});

await test('GET /translate/phrases/ar returns phrases', async () => {
  const { status, data } = await req('GET', '/translate/phrases/ar');
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.language === 'ar', 'Language mismatch');
});

await test('POST /chat/start returns greeting', async () => {
  const { status, data } = await req('POST', '/chat/start', { language: 'en' });
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.greeting || data.response, 'Missing greeting');
});

await test('DELETE /chat clears', async () => {
  const { status } = await req('DELETE', '/chat');
  assert(status === 200, `Expected 200 got ${status}`);
});

await test('GET /chat/history (non-existent)', async () => {
  const { status } = await req('GET', '/chat/history');
  // Non-existent session returns 200 with empty history or 404
  assert(status === 200 || status === 404, `Expected 200 or 404 got ${status}`);
});

// Note: POST /search, /transcribe, /tts, /process-voice, /chat, /translate
// require GROQ/ElevenLabs API keys to actually work. We skip those.
skip('POST /search (full search)', 'requires live platform APIs');
skip('POST /transcribe', 'requires GROQ_API_KEY');
skip('POST /tts', 'requires ELEVENLABS_API_KEY');
skip('POST /process-voice', 'requires GROQ_API_KEY');
skip('POST /chat (text)', 'requires GROQ_API_KEY');
skip('POST /chat/audio', 'requires GROQ_API_KEY');
skip('POST /translate', 'requires GROQ_API_KEY');

// ══════════════════════════════════════════════════════════════════════
//  6. Voucher Flow (end-to-end)
// ══════════════════════════════════════════════════════════════════════

section('Voucher — End-to-End Flow');

await test('Create marketer → register with code → check redemption', async () => {
  // Admin creates a marketer
  const code = `V${rand().toUpperCase()}`;
  const { data: m } = await req('POST', '/admin/marketers', { name: 'Promo', code }, adminToken);
  assert(m._id, 'Marketer not created');

  // User registers with the code
  const vEmail = `voucher_${rand()}@test.com`;
  const { status, data } = await req('POST', '/auth/register', { email: vEmail, password, voucherCode: code });
  assert(status === 201, `Expected 201 got ${status}`);
  assert(data.user.id, 'User not created');

  // Check marketer usedCount incremented
  const { data: updated } = await req('GET', `/admin/marketers/${m._id}`, null, adminToken);
  assert(updated.usedCount === 1, `usedCount should be 1, got ${updated.usedCount}`);

  // Check redemption exists
  const { data: redemptions } = await req('GET', `/admin/marketers/${m._id}/redemptions`, null, adminToken);
  assert(redemptions.total === 1, `Expected 1 redemption got ${redemptions.total}`);
});

// ══════════════════════════════════════════════════════════════════════
//  Cleanup & Summary
// ══════════════════════════════════════════════════════════════════════

await mongoose.disconnect();

console.log('\n══ Summary ═════════════════════════════════════════════');
console.log(`  Sections: ${sections.length}`);
console.log(`  Passed:   ${passed}`);
console.log(`  Failed:   ${failed}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Total:    ${passed + failed + skipped}`);
console.log('═══════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
