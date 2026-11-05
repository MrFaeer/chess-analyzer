import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// OWASP's scrypt baseline: 128 MiB, with a separate memory ceiling for OpenSSL.
const parameters = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const keyLength = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, parameters, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${parameters.N}$${parameters.r}$${parameters.p}$${keyLength}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string | null): Promise<boolean> {
  const parts = encoded?.split('$');
  // Accept only supported parameters; never use unbounded costs from stored data.
  const valid = parts?.length === 7 && parts[0] === 'scrypt' &&
    parts[1] === String(parameters.N) && parts[2] === String(parameters.r) && parts[3] === String(parameters.p) &&
    parts[4] === String(keyLength) && /^[a-f0-9]{32}$/.test(parts[5]) && /^[a-f0-9]{128}$/.test(parts[6]);
  // Unknown users and passwordless accounts still pay the same derivation cost.
  const key = await derive(password, valid ? Buffer.from(parts![5], 'hex') : Buffer.alloc(16));
  const expected = valid ? Buffer.from(parts![6], 'hex') : Buffer.alloc(keyLength);
  return timingSafeEqual(key, expected) && Boolean(valid);
}
