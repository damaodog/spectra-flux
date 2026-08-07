import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the WebGL card generator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>LUMA LAB — WebGL Card Generator<\/title>/i);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  assert.match(html, /随机生成/);
  assert.match(html, /复制 HTML/);
  assert.match(html, /高级设置/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Building your site/i,
  );
});
