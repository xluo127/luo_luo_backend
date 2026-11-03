import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('uses random salts and verifies only the correct password', async () => {
    const password = 'secure-test-password';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong-password', first)).toBe(false);
    expect(await verifyPassword(password, 'malformed')).toBe(false);
  }, 30000);
});
