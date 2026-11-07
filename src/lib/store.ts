import { Redis } from "@upstash/redis";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  readdir,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const directory = () =>
  process.env.CONTENT_DATA_DIR ?? path.join(process.cwd(), ".data");
const key = (name: string) => `donghyeon:${name}`;
const filename = (name: string) =>
  path.join(directory(), encodeURIComponent(name) + ".json");
const redis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
};
function ensureLocal() {
  if (process.env.VERCEL)
    throw new Error(
      "Production sync requires Upstash Redis. Local files are not persistent on Vercel.",
    );
}
export async function readState<T>(name: string): Promise<T | null> {
  const db = redis();
  if (db) return db.get<T>(key(name));
  // A deployment without a live connection may serve the checked-in preview snapshot.
  try {
    return JSON.parse(await readFile(filename(name), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function writeState<T>(name: string, value: T) {
  const db = redis();
  if (db) {
    await db.set(key(name), value);
    return;
  }
  ensureLocal();
  await mkdir(directory(), { recursive: true });
  const temp = filename(name) + "." + randomUUID();
  await writeFile(temp, JSON.stringify(value));
  await rename(temp, filename(name));
}
export async function removeState(name: string) {
  const db = redis();
  if (db) {
    await db.del(key(name));
    return;
  }
  ensureLocal();
  await rm(filename(name), { force: true });
}
export async function listState(prefix: string): Promise<string[]> {
  const db = redis();
  if (db) {
    let cursor = 0;
    const keys: string[] = [];
    do {
      const result = await db.scan(cursor, {
        match: key(prefix) + "*",
        count: 100,
      });
      cursor = Number(result[0]);
      keys.push(...result[1].map((v) => v.slice("donghyeon:".length)));
    } while (cursor !== 0);
    return keys;
  }
  try {
    return (await readdir(/* turbopackIgnore: true */ directory()))
      .filter((f) => f.endsWith(".json"))
      .map((f) => decodeURIComponent(f.slice(0, -5)))
      .filter((f) => f.startsWith(prefix));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}
export async function withSyncLock<T>(
  work: () => Promise<T>,
): Promise<T | null> {
  const token = randomUUID();
  const db = redis();
  if (db) {
    const lock = await db.set(key("sync-lock"), token, { nx: true, ex: 300 });
    if (!lock) return null;
    try {
      return await work();
    } finally {
      await db.eval(
        'if redis.call("get",KEYS[1]) == ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end',
        [key("sync-lock")],
        [token],
      );
    }
  }
  ensureLocal();
  await mkdir(directory(), { recursive: true });
  const dir = path.join(directory(), "sync.lock");
  try {
    await mkdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") return null;
    throw e;
  }
  try {
    return await work();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
