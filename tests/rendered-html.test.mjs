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
  assert.match(html, /查看 01 柔雾扩散/);
  assert.match(html, /查看 06 深景云雾/);
  assert.equal((html.match(/class="preview-card"/g) || []).length, 1);
  assert.equal((html.match(/<canvas/g) || []).length, 1);
  assert.equal((html.match(/class="style-tab(?: |")/g) || []).length, 6);
  assert.match(html, /--card-width:400px/);
  assert.match(html, /--card-height:100px/);
  assert.doesNotMatch(html, /复制此样式|六张共享设置|手动复制 HTML/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Building your site/i,
  );
});
