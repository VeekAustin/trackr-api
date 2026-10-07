import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from './hash';

describe('hashPassword', () => {
  it('produces a hash different from the original password', async () => {
    const hash = await hashPassword('mypassword123');
    expect(hash).not.toBe('mypassword123');
  });

  it('produces different hashes for the same password (due to salting)', async () => {
    const hash1 = await hashPassword('mypassword123');
    const hash2 = await hashPassword('mypassword123');
    expect(hash1).not.toBe(hash2);
  });
});

describe('comparePassword', () => {
  it('returns true when the password matches its hash', async () => {
    const hash = await hashPassword('mypassword123');
    const result = await comparePassword('mypassword123', hash);
    expect(result).toBe(true);
  });

  it('returns false when the password does not match', async () => {
    const hash = await hashPassword('mypassword123');
    const result = await comparePassword('wrongpassword', hash);
    expect(result).toBe(false);
  });
});