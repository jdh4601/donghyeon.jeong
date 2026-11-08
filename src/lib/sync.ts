import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { fetchSnapshot } from "./notion";
import {
  listState,
  readState,
  removeState,
  withSyncLock,
  writeState,
} from "./store";
import { compactId, type ContentSnapshot } from "./types";

export const eventSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(100),
  entity: z.object({ id: z.string().min(1).max(100) }),
  timestamp: z.string().optional(),
});
type Job = {
  id: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
};
export function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export async function enqueueSync(id: string = randomUUID()): Promise<void> {
  if (await readState("done:" + id)) return;
  if (!(await readState("job:" + id)))
    await writeState<Job>("job:" + id, {
      id,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
}
export async function hideDeletedPage(id: string) {
  await writeState("restricted:" + compactId(id), {
    at: new Date().toISOString(),
  });
}
export async function processQueue() {
  return withSyncLock(async () => {
    const deadline = Date.now() + 180000;
    let result: { processed: number; articles?: number } = { processed: 0 };
    // A webhook arriving during a full import may not acquire the lock.
    // Drain those new jobs here instead of leaving them until the daily recovery.
    do {
      const names = (await listState("job:")).slice(0, 100);
      if (!names.length) break;
      try {
        const startedAt = new Date().toISOString();
        const content = await fetchSnapshot();
        await writeState("content", content);
        // Events received while a sync is running must survive that older sync result.
        for (const name of await listState("restricted:")) {
          const restriction = await readState<{ at: string }>(name);
          if (restriction && restriction.at < startedAt)
            await removeState(name);
        }
        for (const name of names) {
          const job = await readState<Job>(name);
          if (job)
            await writeState("done:" + job.id, {
              completedAt: new Date().toISOString(),
            });
          await removeState(name);
        }
        await writeState("sync-status", {
          lastSuccess: content.syncedAt,
          lastError: null,
          pending: Math.max(0, (await listState("job:")).length),
        });
        result = {
          processed: result.processed + names.length,
          articles: content.articles.length,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Sync failed";
        for (const name of names) {
          const job = await readState<Job>(name);
          if (job)
            await writeState(name, {
              ...job,
              attempts: job.attempts + 1,
              lastError: message,
            });
        }
        await writeState("sync-status", {
          lastFailure: new Date().toISOString(),
          lastError: message,
          pending: names.length,
        });
        throw error;
      }
    } while (Date.now() < deadline);
    return result;
  });
}
