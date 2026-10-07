import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';

async function createUserAndGetToken() {
  const res = await request(app).post('/api/auth/signup').send({
    name: 'Track Tester',
    email: `tracktester${Date.now()}@example.com`,
    password: 'password123',
  });
  return res.body.token as string;
}

describe('Track routes', () => {
  it('rejects requests with no token', async () => {
    const res = await request(app).get('/api/tracks');
    expect(res.status).toBe(401);
  });

  it('creates a track for the authenticated user', async () => {
    const token = await createUserAndGetToken();

    const res = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dev', color: '#4d9de0' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('dev');
  });

  it('only returns tracks belonging to the requesting user', async () => {
    const tokenA = await createUserAndGetToken();
    const tokenB = await createUserAndGetToken();

    await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'userA-track', color: '#000000' });

    const res = await request(app)
      .get('/api/tracks')
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0); // user B sees none of user A's tracks
  });

  it('rejects duplicate track names for the same user', async () => {
    const token = await createUserAndGetToken();

    await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dev', color: '#4d9de0' });

    const res = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dev', color: '#000000' });

    expect(res.status).toBe(409);
  });

  it('deletes a track and cascades to its entries', async () => {
    const token = await createUserAndGetToken();

    const trackRes = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'dev', color: '#4d9de0' });
    const trackId = trackRes.body._id;

    await request(app)
      .post('/api/entries')
      .set('Authorization', `Bearer ${token}`)
      .send({ track: trackId, title: 'Test entry', date: '2026-10-01' });

    await request(app)
      .delete(`/api/tracks/${trackId}`)
      .set('Authorization', `Bearer ${token}`);

    const entriesRes = await request(app)
      .get('/api/entries')
      .set('Authorization', `Bearer ${token}`);

    expect(entriesRes.body).toHaveLength(0);
  });

  it('prevents a user from deleting another user\'s track', async () => {
    const tokenA = await createUserAndGetToken();
    const tokenB = await createUserAndGetToken();

    const trackRes = await request(app)
      .post('/api/tracks')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'userA-track', color: '#000000' });

    const res = await request(app)
      .delete(`/api/tracks/${trackRes.body._id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });
});