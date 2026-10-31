import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setCacheClient, CacheClient } from "../utils/cache";
import { Track } from "../models/Track";
import request from "supertest";
import app from "../app";

async function createUserAndGetToken() {
  const email = `tracktester${Date.now()}${Math.random()}@example.com`;
  const password = "password123";

  await request(app)
    .post("/api/auth/signup")
    .send({ name: "Track Tester", email, password });

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });

  return res.body.token as string;
}

describe("Track routes", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/tracks");
    expect(res.status).toBe(401);
  });

  it("creates a track for the authenticated user", async () => {
    const token = await createUserAndGetToken();

    const res = await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "dev", color: "#4d9de0" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("dev");
  });

  it("only returns tracks belonging to the requesting user", async () => {
    const tokenA = await createUserAndGetToken();
    const tokenB = await createUserAndGetToken();

    await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "userA-track", color: "#000000" });

    const res = await request(app)
      .get("/api/tracks")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0); // user B sees none of user A's tracks
  });

  it("rejects duplicate track names for the same user", async () => {
    const token = await createUserAndGetToken();

    await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "dev", color: "#4d9de0" });

    const res = await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "dev", color: "#000000" });

    expect(res.status).toBe(409);
  });

  it("deletes a track and cascades to its entries", async () => {
    const token = await createUserAndGetToken();

    const trackRes = await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "dev", color: "#4d9de0" });
    const trackId = trackRes.body._id;

    await request(app)
      .post("/api/entries")
      .set("Authorization", `Bearer ${token}`)
      .send({ track: trackId, title: "Test entry", date: "2026-10-01" });

    await request(app)
      .delete(`/api/tracks/${trackId}`)
      .set("Authorization", `Bearer ${token}`);

    const entriesRes = await request(app)
      .get("/api/entries")
      .set("Authorization", `Bearer ${token}`);

    expect(entriesRes.body.data).toHaveLength(0);
  });

  it("paginates entries by date, including backfilled ones", async () => {
    const token = await createUserAndGetToken();
    const auth = { Authorization: `Bearer ${token}` };
    const track = await request(app)
      .post("/api/tracks")
      .set(auth)
      .send({ name: "paging", color: "#38bdf8" });

    // Inserted out of date order, like a backfill
    for (const date of ["2026-10-10", "2026-09-01", "2026-10-20"]) {
      await request(app)
        .post("/api/entries")
        .set(auth)
        .send({ track: track.body._id, title: `entry ${date}`, date });
    }

    const first = await request(app).get("/api/entries?limit=2").set(auth);
    expect(first.status).toBe(200);
    expect(first.body.data.map((e: { date: string }) => e.date)).toEqual([
      "2026-10-20",
      "2026-10-10",
    ]);
    expect(first.body.hasNextPage).toBe(true);

    const second = await request(app)
      .get(
        `/api/entries?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
      )
      .set(auth);
    expect(second.body.data.map((e: { date: string }) => e.date)).toEqual([
      "2026-09-01",
    ]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("rejects an invalid cursor", async () => {
    const token = await createUserAndGetToken();
    const res = await request(app)
      .get("/api/entries?cursor=garbage")
      .set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(400);
  });

  it("prevents a user from deleting another user's track", async () => {
    const tokenA = await createUserAndGetToken();
    const tokenB = await createUserAndGetToken();

    const trackRes = await request(app)
      .post("/api/tracks")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "userA-track", color: "#000000" });

    const res = await request(app)
      .delete(`/api/tracks/${trackRes.body._id}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(403);
  });
});

function createFakeCache(): CacheClient {
  const store = new Map<string, string>();
  return {
    async get(key) { return store.get(key) ?? null; },
    async set(key, value) { store.set(key, value); return "OK"; },
    async del(key) { return store.delete(key) ? 1 : 0; },
  };
}

describe("Track caching", () => {
  beforeEach(() => setCacheClient(createFakeCache()));
  afterEach(() => {
    setCacheClient(null);
    vi.restoreAllMocks();
  });

  it("serves repeat reads from the cache and clears it on write", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const findSpy = vi.spyOn(Track, "find");

    const first = await request(app).get("/api/tracks").set(auth);
    const second = await request(app).get("/api/tracks").set(auth);
    expect(first.headers["x-cache"]).toBe("MISS");
    expect(second.headers["x-cache"]).toBe("HIT");
    expect(findSpy).toHaveBeenCalledTimes(1);
    expect(second.body).toEqual(first.body);

    await request(app).post("/api/tracks").set(auth).send({ name: "fresh", color: "#38bdf8" });
    const third = await request(app).get("/api/tracks").set(auth);
    expect(third.headers["x-cache"]).toBe("MISS");
    expect(third.body.map((t: { name: string }) => t.name)).toContain("fresh");
  });

  it("never shows one user's cached tracks to another user", async () => {
    const a = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const b = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    await request(app).post("/api/tracks").set(a).send({ name: "mine", color: "#38bdf8" });
    await request(app).get("/api/tracks").set(a);

    const res = await request(app).get("/api/tracks").set(b);
    expect(res.body).toEqual([]);
  });

  it("still answers when the cache is down", async () => {
    const down = async () => { throw new Error("cache down"); };
    setCacheClient({ get: down, set: down, del: down });

    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const res = await request(app).get("/api/tracks").set(auth);
    expect(res.status).toBe(200);
  });
});

describe("Entry stats", () => {
  it("counts entries, streaks and heatmap days for the requesting user only", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const other = { Authorization: `Bearer ${await createUserAndGetToken()}` };

    const track = (await request(app).post("/api/tracks").set(auth)
      .send({ name: "stats", color: "#38bdf8" })).body._id;
    const otherTrack = (await request(app).post("/api/tracks").set(other)
      .send({ name: "theirs", color: "#38bdf8" })).body._id;

    for (const date of ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-20", "2026-06-01"]) {
      await request(app).post("/api/entries").set(auth)
        .send({ track, title: `entry ${date}`, date });
    }
    await request(app).post("/api/entries").set(other)
      .send({ track: otherTrack, title: "not mine", date: "2026-10-20" });

    const res = await request(app).get("/api/entries/stats?today=2026-10-20").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.activeDays).toBe(4);
    expect(res.body.currentStreak).toBe(3);
    expect(res.body.longestStreak).toBe(3);
    expect(res.body.heatmap).toEqual([
      { date: "2026-10-18", count: 1 },
      { date: "2026-10-19", count: 1 },
      { date: "2026-10-20", count: 2 },
    ]);
  });

  it("falls back to the server's date when the query value is invalid", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const res = await request(app).get("/api/entries/stats?today=garbage").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe("Entry track ownership", () => {
  it("lets a user log an entry on their own track", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const track = (await request(app).post("/api/tracks").set(auth)
      .send({ name: "mine", color: "#38bdf8" })).body._id;

    const res = await request(app).post("/api/entries").set(auth)
      .send({ track, title: "ok", date: "2026-10-20" });
    expect(res.status).toBe(201);
  });

  it("rejects an entry on another user's track", async () => {
    const owner = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const intruder = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const track = (await request(app).post("/api/tracks").set(owner)
      .send({ name: "private", color: "#38bdf8" })).body._id;

    const res = await request(app).post("/api/entries").set(intruder)
      .send({ track, title: "sneaky", date: "2026-10-20" });
    expect(res.status).toBe(403);

    const entries = await request(app).get("/api/entries").set(owner);
    expect(entries.body.data).toHaveLength(0);
  });

  it("rejects a track that does not exist", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    const res = await request(app).post("/api/entries").set(auth)
      .send({ track: "507f1f77bcf86cd799439011", title: "ghost", date: "2026-10-20" });
    expect(res.status).toBe(404);
  });

  it("rejects malformed track ids, including query operators", async () => {
    const auth = { Authorization: `Bearer ${await createUserAndGetToken()}` };
    for (const track of ["garbage", { $ne: null }]) {
      const res = await request(app).post("/api/entries").set(auth)
        .send({ track, title: "bad", date: "2026-10-20" });
      expect(res.status).toBe(400);
    }
  });
});