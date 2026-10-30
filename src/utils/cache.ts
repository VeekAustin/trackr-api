import Redis from "ioredis";

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const DEFAULT_TTL_SECONDS = 60;

function createClientFromEnv(): CacheClient | null {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.log("[cache] REDIS_URL not set, caching is off");
    return null;
  } 

  const redis = new Redis(url, {
    enableOfflineQueue: false, // fail fast when Redis is unreachable instead of queueing
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    commandTimeout: 1000, // never let a hung cache stall a request
  });
  redis.on("ready", () => console.log("[cache] Redis connected"));
  redis.on("error", (err) => console.error("[cache] Redis error:", err.message));
  return redis;
}

let client: CacheClient | null = createClientFromEnv();

// Used by tests to inject a fake client (or null to turn caching off).
export function setCacheClient(next: CacheClient | null): void {
  client = next;
}

export const cacheKeys = {
  tracks: (userId: string) => `tracks:${userId}`,
};

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch (err) {
    console.error("[cache] get failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error("[cache] set failed:", err instanceof Error ? err.message : err);
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!client) return;
  try {
    await client.del(key);
  } catch (err) {
    console.error("[cache] del failed:", err instanceof Error ? err.message : err);
  }
}