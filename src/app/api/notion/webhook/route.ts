import { after } from "next/server";
import {
  enqueueSync,
  eventSchema,
  hideDeletedPage,
  processQueue,
  verifySignature,
} from "@/lib/sync";
import { readState, writeState } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (!process.env.NOTION_TOKEN)
    return Response.json(
      { error: "Notion integration is not configured" },
      { status: 503 },
    );
  const raw = await request.text();
  if (raw.length > 262144) return new Response(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // Store the first challenge server-side. Never print the verification token or expose it publicly.
  if (body && typeof body === "object" && "verification_token" in body) {
    const token = (body as { verification_token: unknown }).verification_token;
    if (typeof token !== "string" || token.length > 512)
      return new Response(null, { status: 400 });
    if (
      !process.env.NOTION_WEBHOOK_SECRET &&
      !(await readState("webhook-verification"))
    )
      await writeState("webhook-verification", {
        token,
        receivedAt: new Date().toISOString(),
      });
    return Response.json({ received: true });
  }
  if (!process.env.NOTION_WEBHOOK_SECRET)
    return Response.json(
      { error: "Webhook verification must be completed" },
      { status: 503 },
    );
  if (
    !verifySignature(
      raw,
      request.headers.get("x-notion-signature"),
      process.env.NOTION_WEBHOOK_SECRET,
    )
  )
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  const event = eventSchema.safeParse(body);
  if (!event.success)
    return Response.json({ error: "Invalid event" }, { status: 400 });
  if (!/^(page|data_source|database)\./.test(event.data.type))
    return Response.json({ ignored: true });
  try {
    if (event.data.type === "page.deleted")
      await hideDeletedPage(event.data.entity.id);
    await enqueueSync(event.data.id);
  } catch {
    return Response.json(
      { error: "Unable to persist event; retry required" },
      { status: 503 },
    );
  }
  after(async () => {
    try {
      await processQueue();
    } catch {
      console.error("Notion synchronization failed; queued for retry.");
    }
  });
  return Response.json({ accepted: true }, { status: 202 });
}
