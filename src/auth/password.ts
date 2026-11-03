import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

function deriveKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt);
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (
    algorithm !== 'scrypt' ||
    !salt ||
    !expectedHex ||
    !/^[a-f0-9]{128}$/.test(expectedHex)
  )
    return false;
  const actual = await deriveKey(password, salt);
  return timingSafeEqual(Buffer.from(expectedHex, 'hex'), actual);
}
