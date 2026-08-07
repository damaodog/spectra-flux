import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  ["01–12", "13–24", "25–36"].forEach((label) => {
    assert.match(html, new RegExp(label));
  });
  assert.equal((html.match(/class="card-study"/g) || []).length, 12);
  assert.equal((html.match(/class="preview-card"/g) || []).length, 12);
  assert.equal((html.match(/class="card-copy"/g) || []).length, 12);
  assert.equal((html.match(/<canvas/g) || []).length, 12);
  assert.equal((html.match(/class="study-meta"/g) || []).length, 12);
  assert.equal((html.match(/class="card-meta"/g) || []).length, 0);
  const studyMeta = [
    "01 · 柔雾扩散",
    "02 · 薄纱碰撞",
    "03 · 横向薄纱",
    "04 · 薄纱断层",
    "05 · 斜向漂移",
    "06 · 丝流拉伸",
    "07 · 双层回流",
    "08 · 绸带折返",
    "09 · 墨丝破浪",
    "10 · 层云错位",
    "11 · 急速奔流",
    "12 · 慢纱呼吸",
  ];
  studyMeta.forEach((label) => assert.match(html, new RegExp(label)));
  assert.equal((html.match(/--card-width:400px/g) || []).length, 12);
  assert.equal((html.match(/--card-height:100px/g) || []).length, 12);
  assert.match(
    html,
    /class="card-study"><span class="study-meta">01 · 柔雾扩散<\/span><article/,
  );
  assert.doesNotMatch(html, /13 · 油膜涌色/);
  assert.doesNotMatch(
    html,
    /class="(?:card-label|card-index|render-label|webgl-error|style-heading|style-tab)/,
  );
  assert.doesNotMatch(html, /复制此样式|六张共享设置|手动复制 HTML/);
  assert.doesNotMatch(
    html,
    /codex-preview|react-loading-skeleton|Building your site/i,
  );
});

test("the gallery shares one WebGL atlas across twelve 2D canvases", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
  assert.match(source, /document\.createElement\("canvas"\)/);
  assert.match(source, /getContext\("2d"\)/);
  assert.match(source, /paramsRef\.current\.forEach\(\(config, index\)/);
  assert.match(source, /gl\.viewport\(atlasX, atlasY, tileWidth, tileHeight\)/);
  assert.match(source, /context\?\.drawImage\(/);
  assert.match(
    source,
    /const ATLAS_ROWS = Math\.ceil\(MOTION_PAGE_SIZE \/ ATLAS_COLUMNS\);/,
  );
  assert.match(source, /configs\.length > 6 \? 1\.5 : 2/);
  assert.match(
    source,
    /cards\.slice\(pageStart, pageStart \+ MOTION_PAGE_SIZE\)/,
  );
  assert.match(
    source,
    /aria-current=\{pageIndex === index \? "page" : undefined\}/,
  );
  assert.match(source, /setPageIndex\(0\)/);
  assert.doesNotMatch(source, /function WebGLPreview|activeIndex|style-tabs/);
});

test("the whole card lifts on precise-pointer hover and respects reduced motion", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(
    css,
    /\.preview-card:hover\s*\{[^}]*transform:\s*translateY\(-6px\) scale\(1\.015\)/s,
  );
  assert.match(
    css,
    /\.preview-card:hover\s*\{[^}]*box-shadow:/s,
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.preview-card:hover\s*\{\s*transform:\s*none;/,
  );
});

test("the gallery uses two columns and a 25 to 75 card split", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.atlas-gallery\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 400px\)\)/s,
  );
  assert.match(
    css,
    /\.preview-card\s*\{[^}]*grid-template-columns:\s*25% 75%/s,
  );
  assert.match(
    css,
    /@media \(max-width: 900px\)[\s\S]*\.atlas-gallery\s*\{[^}]*grid-template-columns:\s*minmax\(0, 400px\)/,
  );
});
