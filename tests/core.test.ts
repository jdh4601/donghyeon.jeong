import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { richText, isPublished, renderBlocks } from "../src/lib/notion";
import {
  enqueueSync,
  processQueue,
  verifySignature,
  hideDeletedPage,
} from "../src/lib/sync";
import {
  readState,
  writeState,
  listState,
  withSyncLock,
} from "../src/lib/store";
import { Prose, normalizeQuotes } from "../src/components/prose";
import { sortArticles, type ContentSnapshot } from "../src/lib/types";
import { getContent } from "../src/lib/content";

test("webhook signature rejects tampering and malformed values", () => {
  const raw = '{"id":"test"}';
  const secret = "test-only-key";
  const sig =
    "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifySignature(raw, sig, secret), true);
  assert.equal(verifySignature(raw + " ", sig, secret), false);
  assert.equal(verifySignature(raw, null, secret), false);
  assert.equal(verifySignature(raw, "sha256=abc", secret), false);
});
test("publication is explicit and archived pages are excluded", () => {
  const page = {
    id: "a",
    properties: { Published: { type: "checkbox", checkbox: true } },
  };
  assert.equal(isPublished(page), true);
  assert.equal(isPublished({ ...page, archived: true }), false);
  assert.equal(isPublished({ ...page, properties: {} }), false);
});
test("rich text preserves formatting and escapes literal markdown", () => {
  assert.equal(
    richText([{ plain_text: "*literal*", annotations: { bold: true } }]),
    "**\\*literal\\***",
  );
  assert.match(
    richText([{ plain_text: "link", href: "https://example.com" }]),
    /\[link\]\(https:\/\/example.com\)/,
  );
});
test("quote decoration does not double-wrap outer source quotes", () => {
  assert.equal(
    normalizeQuotes("> “A true sentence.”"),
    " > A true sentence.".trimStart(),
  );
  assert.equal(
    normalizeQuotes('> "문장입니다.” - p.149'),
    "> 문장입니다. - p.149",
  );
  assert.equal(
    normalizeQuotes("본문의 “따옴표”는 유지"),
    "본문의 “따옴표”는 유지",
  );
});
test("markdown blocks script injection and maps internal Notion links", () => {
  const html = renderToStaticMarkup(
    createElement(Prose, {
      markdown:
        "<script>alert(1)</script>\n\n[글](/p/40b0690db3a68059b5e3ee9986593e85?pvs=25)\n\n[나쁜 링크](javascript:alert(1))",
      links: { "40b0690db3a68059b5e3ee9986593e85": "fixed-slug" },
    }),
  );
  assert.doesNotMatch(html, /<script|href="javascript:/);
  assert.match(html, /href="\/thoughts\/fixed-slug"/);
});
test("article ordering places missing dates last and hides unpublished pages", () => {
  const article = {
    id: "1",
    slug: "one",
    title: "a",
    date: null,
    markdown: "",
    published: true,
  };
  assert.deepEqual(
    sortArticles([
      article,
      { ...article, id: "2", date: "2026-11-01" },
      { ...article, id: "3", published: false },
    ]).map((a) => a.id),
    ["2", "1"],
  );
});
test("unsupported blocks keep a sync from silently dropping content", async () => {
  await assert.rejects(
    renderBlocks([{ id: "x", type: "unknown_block" }]),
    /Unsupported/,
  );
});
test("durable queue, full sync, unpublishing and failure recovery", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "donghyeon-sync-"));
  process.env.CONTENT_DATA_DIR = dataDir;
  process.env.NOTION_TOKEN = "test-token";
  const originalFetch = globalThis.fetch;
  let published = true;
  let fail = false;
  let enqueueDuringImport = false;
  const rich = (s: string) => [{ plain_text: s }];
  const block = (
    id: string,
    type: string,
    body: unknown,
    children = false,
  ) => ({ id, type, [type]: body, has_children: children });
  const source = "40b0690d-b3a6-80f5-a913-000b8fe19941";
  const root = "40b0690d-b3a6-8060-bfda-c09e21781e4f";
  const sections = [
    block("hero", "image", {
      file: {
        url: "https://prod-files-secure.s3.us-west-2.amazonaws.com/test.jpg",
      },
      caption: rich("그림"),
    }),
    block("intro-text", "paragraph", { rich_text: rich("소개") }),
    block("40b0690d-b3a6-804f-b3ac-d7aab2139fb0", "heading_3", {
      rich_text: rich("About"),
    }),
    block("about-text", "paragraph", { rich_text: rich("소개입니다.") }),
    block("40b0690d-b3a6-80db-8423-f227b94cbb71", "heading_3", {
      rich_text: rich("Manifesto"),
    }),
    block("principles", "callout", {}, true),
    block("40b0690d-b3a6-8078-8c24-fd1222e3e3f5", "heading_3", {
      rich_text: rich("Thoughts"),
    }),
  ];
  globalThis.fetch = async (input) => {
    if (fail) throw new Error("simulated network outage");
    const url = String(input);
    if (url.includes("amazonaws.com"))
      return new Response(new Uint8Array([255, 216, 255]), {
        headers: { "content-type": "image/jpeg" },
      });
    let body: unknown;
    if (url.endsWith("data_sources/" + source))
      body = { properties: { Published: { type: "checkbox" } } };
    else if (url.endsWith("/query"))
      body = {
        results: [
          {
            id: "test-page",
            properties: {
              Name: { type: "title", title: rich("원본 글") },
              Date: { type: "date", date: { start: "2026-11-08" } },
              Published: { type: "checkbox", checkbox: published },
            },
          },
        ],
        has_more: false,
      };
    else if (url.includes("blocks/" + root + "/children")) {
      body = { results: sections, has_more: false };
      if (enqueueDuringImport) {
        enqueueDuringImport = false;
        published = false;
        await enqueueSync("arrived-during-import");
      }
    } else if (url.includes("blocks/principles/children"))
      body = {
        results: Array.from({ length: 6 }, (_, i) =>
          block("p" + i, "numbered_list_item", {
            rich_text: rich("Principle " + i + "\n원칙 " + i),
          }),
        ),
        has_more: false,
      };
    else if (url.includes("blocks/test-page/children"))
      body = {
        results: [block("text", "paragraph", { rich_text: rich("최신 본문") })],
        has_more: false,
      };
    else throw new Error("Unexpected request " + url);
    return Response.json(body);
  };
  try {
    await enqueueSync("event-1");
    await enqueueSync("event-1");
    assert.equal((await listState("job:")).length, 1);
    assert.deepEqual(await processQueue(), { processed: 1, articles: 1 });
    const first = await readState<ContentSnapshot>("content");
    assert.equal(first?.articles[0].markdown, "최신 본문");
    assert.equal(first?.home.manifesto.length, 6);
    assert.equal(first?.home.intro, "소개");
    // Recreating sections in Notion changes block IDs; their content must still sync.
    sections.splice(
      1,
      4,
      block("new-intro", "paragraph", { rich_text: rich("교체한 소개 전체") }),
      block("new-about-heading", "heading_2", { rich_text: rich("About") }),
      block("new-about", "paragraph", {
        rich_text: rich(
          "새 소개와 프로젝트: https://github.com/example/project",
        ),
      }),
      block("new-socials", "paragraph", {
        rich_text: rich(
          ":github: github | :linkedin-gray: linkedin | :substack-gray: substack",
        ),
      }),
      block("new-manifesto-heading", "heading_2", {
        rich_text: rich("Manifesto"),
      }),
    );
    await enqueueSync("replace-home-text");
    await processQueue();
    const replaced = await readState<ContentSnapshot>("content");
    assert.equal(replaced?.home.intro, "교체한 소개 전체");
    assert.match(replaced!.home.about, /새 소개와 프로젝트/);
    assert.match(replaced!.home.about, /github.com\/example\/project/);
    assert.doesNotMatch(replaced!.home.about, /substack/);
    await enqueueSync("event-1");
    assert.equal((await listState("job:")).length, 0);
    await hideDeletedPage("test-page");
    assert.equal((await getContent()).articles.length, 0);
    published = false;
    await enqueueSync("event-2");
    await processQueue();
    assert.equal(
      (await readState<ContentSnapshot>("content"))?.articles.length,
      0,
    );
    fail = true;
    await enqueueSync("event-3");
    await assert.rejects(processQueue(), /simulated/);
    assert.equal((await listState("job:")).length, 1);
    assert.ok(await readState("content"));
    fail = false;
    await processQueue();
    assert.equal((await listState("job:")).length, 0);
    published = true;
    enqueueDuringImport = true;
    await enqueueSync("import-before-new-event");
    assert.deepEqual(await processQueue(), { processed: 2, articles: 0 });
    assert.equal((await listState("job:")).length, 0);
    assert.equal(
      (await readState<ContentSnapshot>("content"))?.articles.length,
      0,
    );
    await withSyncLock(async () => {
      assert.equal(await withSyncLock(async () => true), null);
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.NOTION_TOKEN;
    delete process.env.CONTENT_DATA_DIR;
    await rm(dataDir, { recursive: true, force: true });
  }
});
