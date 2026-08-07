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
  assert.match(html, /一键全部随机/);
  assert.match(html, /复制此样式/);
  assert.match(html, /六张共享设置/);
  assert.match(html, /STYLE 01/);
  assert.match(html, /STYLE 06/);
  assert.equal((html.match(/class="preview-card"/g) || []).length, 6);
  assert.match(html, /--card-width:800px/);
  assert.match(html, /--card-height:300px/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Building your site/i,
  );
});
