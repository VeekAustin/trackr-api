import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import { vi, beforeAll } from "vitest";
import { sendPasswordResetEmail } from "../utils/sendEmail";


describe('Auth routes', () => {
  it('signs up a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account created successfully');
    expect(res.body.token).toBeUndefined();
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
    expect(res.body.message).toBe('Login successful');
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


vi.mock("../utils/sendEmail", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("Password reset", () => {
  beforeAll(() => {
    process.env.FRONTEND_URL = "http://localhost:3000";
  });

  it("gives the same reply for an unknown email and sends nothing", async () => {
    vi.mocked(sendPasswordResetEmail).mockClear();
    const res = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "nobody@example.com" });
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("resets the password with a valid token, once only", async () => {
    vi.mocked(sendPasswordResetEmail).mockClear();
    const email = `reset${Date.now()}@example.com`;
    await request(app)
      .post("/api/auth/signup")
      .send({ name: "Reset User", email, password: "oldpassword1" });

    await request(app).post("/api/auth/forgot-password").send({ email });
    const resetUrl = vi.mocked(sendPasswordResetEmail).mock.calls[0][1];
    const token = new URL(resetUrl).searchParams.get("token");

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "newpassword1" });
    expect(reset.status).toBe(200);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "newpassword1" });
    expect(newLogin.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "oldpassword1" });
    expect(oldLogin.status).toBe(401);

    const reuse = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "anotherpass1" });
    expect(reuse.status).toBe(400);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/reset-password")
      .send({ token: "not-a-real-token", password: "newpassword1" });
    expect(res.status).toBe(400);
  });
});