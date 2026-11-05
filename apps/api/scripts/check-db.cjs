// Read-only integration check against the configured local PostgreSQL database.
require('reflect-metadata');
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/prisma/prisma.service');

async function check() {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    app.setGlobalPrefix('api');
    const prisma = app.get(PrismaService);
    assert.deepEqual(await prisma.$queryRaw`SELECT 1 AS value`, [{ value: 1 }]);
    const applied = await prisma.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;
    const migrationRoot = path.join(__dirname, '../prisma/migrations');
    for (const entry of await readdir(migrationRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sql = await readFile(path.join(migrationRoot, entry.name, 'migration.sql'));
      const checksum = createHash('sha256').update(sql).digest('hex');
      assert.ok(applied.some(row => row.migration_name === entry.name && row.finished_at && !row.rolled_back_at && row.checksum === checksum), `Migration is missing, incomplete or changed: ${entry.name}`);
    }
    const counts = { profiles: await prisma.chessProfile.count(), games: await prisma.game.count() };
    // An ephemeral port checks the actual controller without interrupting a dev server.
    await app.listen(0, '127.0.0.1');
    const response = await fetch(`${await app.getUrl()}/api/health/ready`, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200);
    const readiness = await response.json();
    assert.deepEqual(readiness, { status: 'ok', database: 'connected' });
    console.log(JSON.stringify({ query: 'SELECT 1 passed', migrations: 'committed SQL applied with matching checksums', counts, readiness }, null, 2));
  } finally {
    await app.close();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; });
