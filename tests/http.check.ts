import test from "node:test";
import assert from "node:assert/strict";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
test("home serves the real content and all 22 articles are reachable", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /바닷가의 수도승/);
  assert.match(html, /Manifesto/);
  const links = [
    ...new Set(
      [...html.matchAll(/href="(\/thoughts\/[^"#?]+)"/g)].map((m) => m[1]),
    ),
  ];
  assert.equal(links.length, 22);
  for (let i = 0; i < links.length; i += 4) {
    const responses = await Promise.all(
      links.slice(i, i + 4).map((link) => fetch(base + link)),
    );
    for (const page of responses) {
      assert.equal(page.status, 200);
      assert.ok((await page.text()).includes("<main"));
    }
  }
});
test("unknown and unpublished paths return 404", async () => {
  assert.equal(
    (await fetch(base + "/thoughts/unpublished-example")).status,
    404,
  );
});
test("seed images require a current published reference and are not cached publicly", async () => {
  const html = await (await fetch(base)).text();
  const media = html.match(/\/media\/[a-f0-9]{64}/)?.[0];
  assert.ok(media);
  const response = await fetch(base + media);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^image\//);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.ok((await response.arrayBuffer()).byteLength > 0);
  assert.equal((await fetch(base + "/media/" + "a".repeat(64))).status, 404);
});
test("sync endpoints and unsigned webhooks reject public calls", async () => {
  assert.equal((await fetch(base + "/api/sync")).status, 401);
  assert.equal(
    (await fetch(base + "/api/sync", { method: "POST" })).status,
    401,
  );
  const webhook = await fetch(base + "/api/notion/webhook", {
    method: "POST",
    body: "{}",
  });
  assert.ok([401, 503].includes(webhook.status));
});
test("sitemap contains the expected site and article URLs", async () => {
  const response = await fetch(base + "/sitemap.xml");
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal((text.match(/<loc>/g) ?? []).length, 23);
});
