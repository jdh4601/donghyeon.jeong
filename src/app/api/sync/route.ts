import { enqueueSync, processQueue } from "@/lib/sync";
import { readState } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;
function authorized(request: Request) {
  return (
    !!process.env.CRON_SECRET &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
  );
}
export async function POST(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await enqueueSync();
    const result = await processQueue();
    return Response.json(result ?? { busy: true });
  } catch {
    return Response.json(
      { error: "Sync failed; check authenticated status endpoint" },
      { status: 503 },
    );
  }
}
export async function GET(request: Request) {
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (new URL(request.url).searchParams.has("status"))
    return Response.json(
      (await readState("sync-status")) ?? {
        configured: !!process.env.NOTION_TOKEN,
        lastSuccess: null,
      },
    );
  return POST(request);
}
