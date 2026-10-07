import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { generateToken } from './token';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-unit-tests';
});

describe('generateToken', () => {
  it('produces a token that can be verified with the same secret', () => {
    const token = generateToken('abc123', 'user');
    const decoded = jwt.verify(token, 'test-secret-for-unit-tests') as any;
    expect(decoded.id).toBe('abc123');
    expect(decoded.role).toBe('user');
  });

  it('throws if the token is verified with a different secret', () => {
    const token = generateToken('abc123', 'user');
    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });
});