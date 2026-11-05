// Integration checks only against an explicitly configured, separate test database.
require('reflect-metadata');
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

async function check() {
  const normalUrl = new URL(process.env.DATABASE_URL);
  const testUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
  const database = decodeURIComponent(testUrl.pathname.slice(1));
  assert.match(database, /^[a-z0-9_]+_auth_test$/, 'TEST_DATABASE_URL must name a dedicated database ending in _auth_test');
  assert.notEqual(database, decodeURIComponent(normalUrl.pathname.slice(1)), 'The normal database must never be used for auth tests');
  assert.ok(!testUrl.searchParams.has('schema') || testUrl.searchParams.get('schema') === 'public', 'Use the public schema in the test database');
  process.env.DATABASE_URL = testUrl.href;
  process.env.APP_ORIGIN = 'http://127.0.0.1:5173';
  process.env.NODE_ENV = 'test';
  const migration = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: path.join(__dirname, '..'), env: process.env, stdio: 'pipe', encoding: 'utf8',
  });
  assert.equal(migration.status, 0, migration.stderr || migration.stdout);
  const { NestFactory } = require('@nestjs/core');
  const { Controller, Get, Module } = require('@nestjs/common');
  const { AppModule } = require('../dist/app.module');
  const { PrismaService } = require('../dist/prisma/prisma.service');
  const { verifyPassword } = require('../dist/auth/password');

  // A deliberately unannotated endpoint proves that future controllers are private by default.
  class PrivateController { read() { return { private: true }; } }
  Controller('private-check')(PrivateController);
  Get()(PrivateController.prototype, 'read', Object.getOwnPropertyDescriptor(PrivateController.prototype, 'read'));
  class TestModule {}
  Module({ imports: [AppModule], controllers: [PrivateController] })(TestModule);

  let app;
  let prisma;
  let base;
  const prefix = `at_${randomBytes(5).toString('hex')}`;
  const password = 'An integration password 123!';
  const fixtures = suffix => ({ login: `${prefix}_${suffix}`, email: `${prefix}_${suffix}@example.com`, password, confirmPassword: password, language: 'ru' });
  const request = (route, { method = 'POST', cookie, body = {}, headers = {} } = {}) => fetch(`${base}/api/${route}`, {
    method, headers: { Origin: process.env.APP_ORIGIN, 'Content-Type': 'application/json', 'X-CSRF-Protection': '1', ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  const cookieOf = response => {
    const header = response.headers.get('set-cookie');
    assert.ok(header);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /SameSite=Lax/i);
    assert.match(header, /Path=\/api/i);
    assert.match(header, /Max-Age=604800/);
    return header.split(';')[0];
  };
  async function start(production = false) {
    if (app) await app.close();
    process.env.NODE_ENV = production ? 'production' : 'test';
    process.env.APP_ORIGIN = production ? 'https://chess.example' : 'http://127.0.0.1:5173';
    app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    prisma = app.get(PrismaService);
    assert.equal((await prisma.$queryRaw`SELECT current_database() AS name`)[0].name, database);
  }
  try {
    await start();
    assert.equal((await request('health', { method: 'GET' })).status, 200);
    assert.equal((await request('private-check', { method: 'GET' })).status, 401);
    assert.equal((await request('auth/me', { method: 'GET' })).status, 401);

    // CSRF applies before authentication, including registration, login and logout.
    for (const route of ['register', 'login', 'logout']) {
      for (const headers of [{ Origin: 'https://evil.example' }, { Origin: '' }, { 'X-CSRF-Protection': '' }, { 'Content-Type': 'text/plain' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
        assert.equal((await request(`auth/${route}`, { body: fixtures('csrf'), headers })).status, 403, `CSRF: ${route}`);
      }
    }
    assert.equal(await prisma.user.count({ where: { loginNormalized: { startsWith: prefix } } }), 0);
    for (const body of [
      { ...fixtures('bad'), login: 'not@allowed' },
      { ...fixtures('bad'), email: '' },
      { ...fixtures('bad'), email: 'bad' },
      { ...fixtures('bad'), password: 'short', confirmPassword: 'short' },
      { ...fixtures('bad'), confirmPassword: 'different password' },
    ]) assert.equal((await request('auth/register', { body })).status, 400);

    await start();
    const data = fixtures('main');
    const registered = await request('auth/register', { body: data });
    assert.equal(registered.status, 201);
    const user = await registered.json();
    assert.equal(user.emailVerifiedAt, null);
    assert.equal(user.language, 'ru');
    assert.equal(user.passwordHash, undefined);
    assert.equal(user.loginNormalized, undefined);
    let cookie = cookieOf(registered);
    assert.doesNotMatch(registered.headers.get('set-cookie'), /; Secure/i);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(stored.emailVerifiedAt, null);
    assert.match(stored.passwordHash, /^scrypt\$131072\$8\$1\$64\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    assert.ok(await verifyPassword(password, stored.passwordHash));
    assert.equal(await verifyPassword('a wrong password', stored.passwordHash), false);
    const token = cookie.split('=')[1];
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await prisma.session.findUniqueOrThrow({ where: { tokenHash } });
    assert.notEqual(tokenHash, token);
    assert.ok(Math.abs(session.expiresAt - session.createdAt - 604800000) < 5000);
    assert.equal((await request('private-check', { method: 'GET', cookie })).status, 200);
    assert.equal((await request('auth/me', { method: 'GET', cookie })).headers.get('cache-control'), 'no-store');
    assert.equal((await request('auth/me', { method: 'GET', cookie: `${cookie}; ${cookie}` })).status, 401);
    assert.equal((await request('auth/me', { method: 'GET', cookie: 'chess_session=malformed' })).status, 401);

    assert.equal((await request('auth/register', { body: { ...fixtures('duplicate_login'), login: data.login.toUpperCase() } })).status, 409);
    assert.equal((await request('auth/register', { body: { ...fixtures('duplicate_email'), email: ` ${data.email.toUpperCase()} ` } })).status, 409);

    // Simultaneous requests race at the actual database constraints.
    for (const field of ['login', 'email']) {
      const a = fixtures(`race_${field}_a`);
      const b = fixtures(`race_${field}_b`);
      b[field] = a[field].toUpperCase();
      const responses = await Promise.all([request('auth/register', { body: a }), request('auth/register', { body: b })]);
      assert.deepEqual(responses.map(response => response.status).sort(), [201, 409], `Concurrent ${field}`);
    }
    const hashes = await prisma.user.findMany({ where: { loginNormalized: { startsWith: prefix }, passwordHash: { not: null } }, select: { passwordHash: true } });
    assert.equal(new Set(hashes.map(row => row.passwordHash.split('$')[5])).size, hashes.length);
    await assert.rejects(prisma.user.create({ data: { login: `${prefix}_bypass@`, loginNormalized: `${prefix}_bypass@` } }));
    await assert.rejects(prisma.user.create({ data: { login: `${prefix}_bypass`, loginNormalized: `${prefix}_BYPASS` } }));
    await assert.rejects(prisma.user.create({ data: { login: `${prefix}_email_bad`, loginNormalized: `${prefix}_email_bad`, email: 'Case@example.com', emailNormalized: 'Case@example.com' } }));
    await assert.rejects(prisma.user.create({ data: { login: data.login.toUpperCase(), loginNormalized: data.login.toLowerCase() } }));

    // A rejected cross-origin logout must leave the authenticated session valid.
    assert.equal((await request('auth/logout', { cookie, headers: { Origin: 'https://evil.example' } })).status, 403);
    assert.equal((await request('auth/me', { method: 'GET', cookie })).status, 200);
    const logout = await request('auth/logout', { cookie });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    assert.equal(await prisma.session.count({ where: { tokenHash } }), 0);
    assert.equal((await request('auth/me', { method: 'GET', cookie })).status, 401);
    assert.equal((await request('auth/logout', { cookie })).status, 204);

    // A new app proves sessions survive an API process restart.
    await start();
    for (const identifier of [data.login.toUpperCase(), ` ${data.email.toUpperCase()} `]) {
      const login = await request('auth/login', { body: { identifier, password }, cookie });
      assert.equal(login.status, 200);
      const next = cookieOf(login);
      assert.notEqual(next, cookie);
      assert.equal((await request('auth/me', { method: 'GET', cookie })).status, 401);
      cookie = next;
    }
    await start();
    assert.equal((await request('auth/me', { method: 'GET', cookie })).status, 200);
    const changed = await request('auth/preferences', { method: 'PATCH', cookie, body: { language: 'lv' } });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).language, 'lv');
    assert.equal((await request('auth/preferences', { method: 'PATCH', cookie, body: { language: 'xx' } })).status, 400);
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    assert.equal((await request('auth/me', { method: 'GET', cookie })).status, 401);
    const passwordless = await prisma.user.create({ data: { login: `${prefix}_oauth`, loginNormalized: `${prefix}_oauth` } });
    assert.equal(passwordless.passwordHash, null);
    assert.equal(passwordless.email, null);
    for (const identifier of [data.login, `${prefix}_missing`, passwordless.login]) {
      const response = await request('auth/login', { body: { identifier, password: 'An incorrect password' } });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, 'invalidCredentials');
    }

    await start();
    for (let index = 0; index < 10; index++) assert.equal((await request('auth/register')).status, 400);
    assert.equal((await request('auth/register')).status, 429);
    await start();
    for (let index = 0; index < 20; index++) assert.equal((await request('auth/login')).status, 400);
    assert.equal((await request('auth/login')).status, 429);
    await start();
    for (let index = 0; index < 10; index++) assert.equal((await request('auth/login', { body: { identifier: data.login, password: 'wrong' } })).status, 401);
    assert.equal((await request('auth/login', { body: { identifier: data.login, password } })).status, 429);
    assert.equal((await request('auth/login', { body: { identifier: `${prefix}_other`, password } })).status, 401);

    await start(true);
    const productionLogin = await request('auth/login', { body: { identifier: data.login, password } });
    assert.equal(productionLogin.status, 200);
    const secureCookie = cookieOf(productionLogin);
    assert.match(secureCookie, /^__Secure-chess_session=/);
    assert.match(productionLogin.headers.get('set-cookie'), /; Secure/i);
    assert.equal((await request('auth/logout', { cookie: secureCookie })).status, 204);
    assert.equal((await request('auth/me', { method: 'GET', cookie: secureCookie })).status, 401);
    console.log('Auth checks passed: isolated database, validation, concurrent uniqueness, scrypt, CSRF, cookies, restart/rotation/expiry/logout, private-by-default API, preferences, passwordless model, IP/identifier rate limits.');
  } finally {
    if (prisma) await prisma.user.deleteMany({ where: { loginNormalized: { startsWith: prefix } } });
    if (app) await app.close();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
