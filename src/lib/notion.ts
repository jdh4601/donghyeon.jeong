import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import {
  compactId,
  type ContentSnapshot,
  type HomeContent,
  type Article,
} from "./types";
import { readState, writeState } from "./store";

export const ROOT_ID = "40b0690d-b3a6-8060-bfda-c09e21781e4f";
export const SOURCE_ID = "40b0690d-b3a6-80f5-a913-000b8fe19941";
type Rich = {
  plain_text?: string;
  text?: { content: string; link?: { url: string } | null };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    strikethrough?: boolean;
  };
  href?: string | null;
};
export type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};
type Page = {
  id: string;
  properties: Record<
    string,
    {
      type?: string;
      title?: Rich[];
      date?: { start: string } | null;
      checkbox?: boolean;
      rich_text?: Rich[];
    }
  >;
  archived?: boolean;
  in_trash?: boolean;
};
type BlockBody = {
  rich_text?: Rich[];
  caption?: Rich[];
  language?: string;
  type?: string;
  file?: { url: string };
  external?: { url: string };
  url?: string;
  expression?: string;
  checked?: boolean;
};

export function richText(items: Rich[] = []): string {
  return items
    .map((item) => {
      let text = (item.plain_text ?? item.text?.content ?? "").replace(
        /[\\`*_[\]<>]/g,
        "\\$&",
      );
      const a = item.annotations;
      if (a?.code) text = "`" + text.replaceAll("`", "") + "`";
      else {
        if (a?.bold) text = "**" + text + "**";
        if (a?.italic) text = "*" + text + "*";
        if (a?.strikethrough) text = "~~" + text + "~~";
      }
      const href = item.href ?? item.text?.link?.url;
      return href ? `[${text}](${href.replaceAll(")", "%29")})` : text;
    })
    .join("");
}
function plain(items: Rich[] = []) {
  return items.map((r) => r.plain_text ?? r.text?.content ?? "").join("");
}

export function isPublished(page: Page): boolean {
  const property = process.env.NOTION_PUBLISHED_PROPERTY ?? "Published";
  return (
    !page.archived &&
    !page.in_trash &&
    page.properties[property]?.type === "checkbox" &&
    page.properties[property].checkbox === true
  );
}
export async function notionRequest<T>(
  route: string,
  body?: unknown,
): Promise<T> {
  if (!process.env.NOTION_TOKEN)
    throw new Error("NOTION_TOKEN is not configured");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`https://api.notion.com/v1/${route}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": "2025-09-03",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const data = await response.json();
      await new Promise((r) => setTimeout(r, 350));
      return data as T;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 3) {
      await new Promise((r) =>
        setTimeout(
          r,
          Math.min(
            10000,
            Number(response.headers.get("retry-after") ?? attempt + 1) * 1000,
          ),
        ),
      );
      continue;
    }
    throw new Error(`Notion ${response.status} for ${route.split("?")[0]}`);
  }
  throw new Error("Notion retry exhausted");
}
export async function listBlocks(id: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({
      page_size: "100",
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const data = await notionRequest<{
      results: NotionBlock[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`blocks/${id}/children?${params}`);
    blocks.push(...data.results);
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return blocks;
}

const allowedMedia = (url: URL) =>
  url.protocol === "https:" &&
  (url.hostname === "prod-files-secure.s3.us-west-2.amazonaws.com" ||
    url.hostname === "s3.us-west-2.amazonaws.com" ||
    url.hostname === "s3.us-west-2.amazonaws.com" ||
    url.hostname.endsWith(".amazonaws.com") ||
    url.hostname === "www.notion.so" ||
    url.hostname === "file.notion.so" ||
    url.hostname === "prod-files-secure.s3.amazonaws.com");
export async function mirrorImage(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!allowedMedia(parsed))
    throw new Error("Unsupported image host; review it before publishing");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Image download failed");
  const type = response.headers.get("content-type")?.split(";")[0] ?? "";
  const ext = (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/avif": "avif",
    } as Record<string, string>
  )[type];
  if (!ext) throw new Error("Unsupported image format");
  if (Number(response.headers.get("content-length")) > 15 * 1024 * 1024)
    throw new Error("Image too large");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body!) {
    size += chunk.byteLength;
    if (size > 15 * 1024 * 1024) throw new Error("Image too large");
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const name = `notion/${hash}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    // Private objects are only exposed through /media after checking current published references.
    const object = await put(name, bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: type,
    });
    await writeState("media:" + hash, {
      pathname: object.pathname,
      contentType: type,
    });
    return `/media/${hash}`;
  }
  if (process.env.VERCEL)
    throw new Error("Private Blob storage is required for production images");
  const target = path.join(
    process.env.CONTENT_DATA_DIR ?? path.join(process.cwd(), ".data"),
    "media",
  );
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, hash), bytes);
  await writeState("media:" + hash, { pathname: hash, contentType: type });
  return `/media/${hash}`;
}

export async function renderBlocks(blocks: NotionBlock[]): Promise<string> {
  const result: string[] = [];
  for (const block of blocks) {
    const body = (block[block.type] ?? {}) as BlockBody;
    const text = richText(body.rich_text);
    let out = "";
    const nested = block.has_children
      ? await renderBlocks(await listBlocks(block.id))
      : "";
    switch (block.type) {
      case "paragraph":
        out = text;
        break;
      case "heading_1":
        out = "# " + text;
        break;
      case "heading_2":
        out = "## " + text;
        break;
      case "heading_3":
        out = "### " + text;
        break;
      case "quote":
        out = (text + (nested ? "\n" + nested : ""))
          .split("\n")
          .map((l) => "> " + l)
          .join("\n");
        break;
      case "bulleted_list_item":
        out =
          "- " +
          text +
          (nested
            ? "\n" +
              nested
                .split("\n")
                .map((l) => "  " + l)
                .join("\n")
            : "");
        break;
      case "numbered_list_item":
        out =
          "1. " +
          text +
          (nested
            ? "\n" +
              nested
                .split("\n")
                .map((l) => "   " + l)
                .join("\n")
            : "");
        break;
      case "to_do":
        out = `- ${body.checked ? "☑" : "☐"} ${text}`;
        break;
      case "divider":
        out = "---";
        break;
      case "code":
        out =
          "```" +
          (body.language ?? "") +
          "\n" +
          plain(body.rich_text) +
          "\n```";
        break;
      case "callout":
        out = text + (nested ? "\n\n" + nested : "");
        break;
      case "image": {
        const source = body.file?.url ?? body.external?.url;
        if (!source) throw new Error("Image missing source");
        out = `![${plain(body.caption).replaceAll("]", "")} ](${await mirrorImage(source)})`;
        break;
      }
      case "video":
      case "embed":
      case "bookmark":
      case "link_preview": {
        const source = body.url ?? body.external?.url;
        if (source) out = `[관련 영상 또는 페이지](${source})`;
        break;
      }
      case "child_page":
        out = `[${String((block.child_page as { title: string }).title)}](https://app.notion.com/${compactId(block.id)})`;
        break;
      case "child_database":
        break;
      case "toggle":
        out = "**" + text + "**\n\n" + nested;
        break;
      case "column_list":
      case "column":
      case "synced_block":
        out = nested;
        break;
      case "equation":
        out = body.expression ?? "";
        break;
      default:
        throw new Error(
          `Unsupported Notion block: ${block.type}. Previous published version retained.`,
        );
    }
    if (
      nested &&
      ![
        "quote",
        "bulleted_list_item",
        "numbered_list_item",
        "callout",
        "toggle",
        "column_list",
        "column",
        "synced_block",
      ].includes(block.type)
    )
      out += "\n\n" + nested;
    result.push(out);
  }
  return result.filter(Boolean).join("\n\n");
}

async function homeContent(): Promise<HomeContent> {
  const blocks = await listBlocks(process.env.NOTION_ROOT_PAGE_ID ?? ROOT_ID);
  const sectionIds: Record<string, string> = {
    intro: "40b0690db3a6806ba953d52476906787",
    about: "40b0690db3a6804fb3acd7aab2139fb0",
    manifesto: "40b0690db3a680db8423f227b94cbb71",
    thoughts: "40b0690db3a680788c24fd1222e3e3f5",
  };
  const sections: Record<string, NotionBlock[]> = {
    intro: [],
    about: [],
    manifesto: [],
    thoughts: [],
  };
  let current = "";
  let hero: NotionBlock | undefined;
  for (const block of blocks) {
    const body = (block[block.type] ?? {}) as BlockBody;
    if (block.type === "image" && !hero) {
      hero = block;
      continue;
    }
    if (block.type.startsWith("heading_")) {
      const matched = Object.entries(sectionIds).find(
        ([, id]) => id === compactId(block.id),
      );
      const label = plain(body.rich_text).toLowerCase().trim();
      if (matched) {
        current = matched[0];
        continue;
      }
      if (label in sections) {
        current = label;
        continue;
      }
    }
    if (current) sections[current].push(block);
  }
  if (
    !hero ||
    !sections.intro.length ||
    !sections.about.length ||
    !sections.manifesto.length
  )
    throw new Error(
      "Home section mapping changed; keep the last valid version and repair mapping",
    );
  // The social-link paragraph belongs to the fixed About component, not the editable bio.
  const bio = sections.about.filter(
    (b) => !JSON.stringify(b).includes("github.com"),
  );
  const manifestoText = await renderBlocks(sections.manifesto);
  const principles = manifestoText
    .split(/\n\n(?=\d+\. )/)
    .map((v) =>
      v
        .replace(/^\d+\.\s*/, "")
        .replace(/[*]/g, "")
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .filter((v) => v.length >= 2)
    .map(([en, ...ko]) => ({ en, ko: ko.join(" ") }));
  if (principles.length !== 6)
    throw new Error("Expected six manifesto principles");
  const body = hero.image as BlockBody;
  const url = body.file?.url ?? body.external?.url;
  if (!url) throw new Error("Missing hero");
  return {
    intro: await renderBlocks(sections.intro),
    about: await renderBlocks(bio),
    manifesto: principles,
    image: await mirrorImage(url),
    caption: plain(body.caption) || "프리드리히 〈바닷가의 수도승〉 1808–1810",
  };
}

export async function fetchSnapshot(): Promise<ContentSnapshot> {
  const source = process.env.NOTION_DATA_SOURCE_ID ?? SOURCE_ID;
  const schema = await notionRequest<{ properties: Record<string, unknown> }>(
    `data_sources/${source}`,
  );
  const publishedProperty =
    process.env.NOTION_PUBLISHED_PROPERTY ?? "Published";
  if (!schema.properties[publishedProperty])
    throw new Error(
      `Add a ${publishedProperty} checkbox to the website data source before enabling live sync`,
    );
  const pages: Page[] = [];
  let cursor: string | undefined;
  do {
    const data = await notionRequest<{
      results: Page[];
      has_more: boolean;
      next_cursor: string | null;
    }>(`data_sources/${source}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...data.results);
    cursor = data.has_more ? (data.next_cursor ?? undefined) : undefined;
  } while (cursor);
  const previous = await readState<ContentSnapshot>("content");
  const existing = new Map(
    previous?.articles.map((a) => [compactId(a.id), a]) ?? [],
  );
  const articles: Article[] = [];
  // Publish removals before lengthy body downloads; later failures cannot resurrect a private article.
  const allowed = new Set(
    pages.filter(isPublished).map((p) => compactId(p.id)),
  );
  if (previous)
    await writeState("content", {
      ...previous,
      articles: previous.articles.filter((a) => allowed.has(compactId(a.id))),
    });
  for (const page of pages) {
    if (!isPublished(page)) continue;
    const id = compactId(page.id);
    const title = plain(
      Object.values(page.properties).find((p) => p.type === "title")?.title,
    );
    const date = page.properties.Date?.date?.start ?? null;
    articles.push({
      id,
      slug: existing.get(id)?.slug ?? id,
      title,
      date,
      published: true,
      markdown: await renderBlocks(await listBlocks(page.id)),
    });
  }
  return {
    home: await homeContent(),
    articles,
    source: "notion-api",
    syncedAt: new Date().toISOString(),
  };
}
