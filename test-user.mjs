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
  const data = await res.json();
  return { status: res.status, data };
}

// ── Setup: register a user ────────────────────────────────────────────

const email = `user_${rand()}@example.com`;
const password = 'TestP@ss123';
let token;

console.log('\n── User Endpoint Tests ──────────────────────────────\n');

// Register and get token
const { data: regData } = await req('POST', '/auth/register', { email, password, name: 'Test User' });
token = regData.token;
assert(token, 'Setup failed: no token from register');
console.log(`  [setup] Registered ${email}\n`);

// ── Profile tests ─────────────────────────────────────────────────────

await test('GET /me returns profile', async () => {
  const { status, data } = await req('GET', '/users/me', null, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.email === email, 'Email mismatch');
  assert(!data.password, 'Password should not be returned');
});

await test('GET /me without token → 401', async () => {
  const { status } = await req('GET', '/users/me');
  assert(status === 401, `Expected 401 got ${status}`);
});

await test('PATCH /me updates name', async () => {
  const { status, data } = await req('PATCH', '/users/me', { name: 'Updated Name' }, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.name === 'Updated Name', `Name not updated: ${data.name}`);
});

await test('PATCH /me updates preferences', async () => {
  const prefs = { language: 'ar', country: 'QA', theme: 'dark' };
  const { status, data } = await req('PATCH', '/users/me', { preferences: prefs }, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.preferences.language === 'ar', 'Preferences not updated');
});

await test('PATCH /me ignores disallowed fields', async () => {
  const { status, data } = await req('PATCH', '/users/me', { role: 'ADMIN', email: 'hacked@x.com' }, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.role === 'USER', 'Role should not change');
  assert(data.email === email, 'Email should not change');
});

await test('PATCH /me/password changes password', async () => {
  const newPw = 'NewP@ss456';
  const { status } = await req('PATCH', '/users/me/password', {
    currentPassword: password,
    newPassword: newPw,
  }, token);
  assert(status === 200, `Expected 200 got ${status}`);

  // Old token should be revoked (sessions cleared)
  const { status: s2 } = await req('GET', '/users/me', null, token);
  assert(s2 === 401, `Old token should be revoked, got ${s2}`);

  // Login with new password
  const { status: s3, data: d3 } = await req('POST', '/auth/login', { email, password: newPw });
  assert(s3 === 200, `Login with new password failed: ${s3}`);
  token = d3.token; // update token for remaining tests
});

await test('PATCH /me/password wrong current → 401', async () => {
  const { status } = await req('PATCH', '/users/me/password', {
    currentPassword: 'wrongpassword',
    newPassword: 'Whatever123',
  }, token);
  assert(status === 401, `Expected 401 got ${status}`);
});

await test('PATCH /me/password missing fields → 400', async () => {
  const { status } = await req('PATCH', '/users/me/password', { newPassword: 'x' }, token);
  assert(status === 400, `Expected 400 got ${status}`);
});

// ── Location tests ────────────────────────────────────────────────────

let locationId;

await test('POST /me/locations creates location', async () => {
  const { status, data } = await req('POST', '/users/me/locations', {
    label: 'Home', lat: 25.286, lon: 51.534, country: 'QA', address: '123 Main St',
  }, token);
  assert(status === 201, `Expected 201 got ${status}: ${JSON.stringify(data)}`);
  assert(data.label === 'Home', 'Label mismatch');
  locationId = data._id;
});

await test('POST /me/locations missing fields → 400', async () => {
  const { status } = await req('POST', '/users/me/locations', { label: 'Work' }, token);
  assert(status === 400, `Expected 400 got ${status}`);
});

await test('GET /me/locations lists locations', async () => {
  const { status, data } = await req('GET', '/users/me/locations', null, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(Array.isArray(data), 'Expected array');
  assert(data.length >= 1, 'Should have at least 1 location');
});

await test('PATCH /me/locations/:id updates location', async () => {
  const { status, data } = await req('PATCH', `/users/me/locations/${locationId}`, { label: 'Office' }, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.label === 'Office', `Label not updated: ${data.label}`);
});

await test('PATCH /me/locations/:id/default sets default', async () => {
  const { status, data } = await req('PATCH', `/users/me/locations/${locationId}/default`, {}, token);
  assert(status === 200, `Expected 200 got ${status}`);
  assert(data.isDefault === true, 'Should be default');
});

await test('Second location + set default unsets first', async () => {
  // Add second location as default
  const { data: loc2 } = await req('POST', '/users/me/locations', {
    label: 'Work', lat: 25.3, lon: 51.5, country: 'QA', isDefault: true,
  }, token);

  // First location should no longer be default
  const { data: all } = await req('GET', '/users/me/locations', null, token);
  const first = all.find(l => l._id === locationId);
  const second = all.find(l => l._id === loc2._id);
  assert(first.isDefault === false, 'First should no longer be default');
  assert(second.isDefault === true, 'Second should be default');
});

await test('DELETE /me/locations/:id removes location', async () => {
  const { status } = await req('DELETE', `/users/me/locations/${locationId}`, null, token);
  assert(status === 200, `Expected 200 got ${status}`);

  // Verify it's gone
  const { data: all } = await req('GET', '/users/me/locations', null, token);
  const found = all.find(l => l._id === locationId);
  assert(!found, 'Location should be deleted');
});

await test('DELETE non-existent location → 404', async () => {
  const { status } = await req('DELETE', '/users/me/locations/000000000000000000000000', null, token);
  assert(status === 404, `Expected 404 got ${status}`);
});

// Summary
console.log(`\n── Results: ${passed} passed, ${failed} failed ──────────\n`);
process.exit(failed > 0 ? 1 : 0);
