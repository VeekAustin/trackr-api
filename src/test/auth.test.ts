import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('Auth routes', () => {
  it('signs up a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password).toBeUndefined(); // password must never be returned
  });

  it('rejects signup with a missing field', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
    });

    expect(res.status).toBe(400);
  });

  it('rejects signup with a duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'First',
      email: 'dupe@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/signup').send({
      name: 'Second',
      email: 'dupe@example.com',
      password: 'password456',
    });

    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Login Test 2',
      email: 'login2@example.com',
      password: 'password123',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'login2@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
  });
});