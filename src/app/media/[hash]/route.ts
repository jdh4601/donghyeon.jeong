import { get } from "@vercel/blob";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getContent } from "@/lib/content";
import { readState } from "@/lib/store";
import seedMedia from "@/content/media-manifest.json";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 404 });
  const content = await getContent();
  const needle = "/media/" + hash;
  if (
    content.home.image !== needle &&
    !content.articles.some((a) => a.published && a.markdown.includes(needle))
  )
    return new Response(null, { status: 404 });
  const seed = (
    seedMedia as Record<string, { file: string; contentType: string }>
  )[hash];
  const meta = await readState<{ pathname: string; contentType: string }>(
    "media:" + hash,
  );
  if (!meta && !seed) return new Response(null, { status: 404 });
  // Do not let intermediary caches keep serving an image after its article becomes private.
  const headers = {
    "Content-Type": (meta ?? seed).contentType,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!meta && seed) {
    const bytes = await readFile(
      path.join(process.cwd(), "src/content/media", seed.file),
    );
    return new Response(bytes, { headers });
  }
  if (!meta) return new Response(null, { status: 404 });
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const object = await get(meta.pathname, { access: "private" });
    if (!object || object.statusCode !== 200)
      return new Response(null, { status: 404 });
    return new Response(object.stream, { headers });
  }
  try {
    const bytes = await readFile(
      path.join(
        process.env.CONTENT_DATA_DIR ?? path.join(process.cwd(), ".data"),
        "media",
        hash,
      ),
    );
    return new Response(bytes, { headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}
