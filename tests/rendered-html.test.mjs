import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
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
  assert.match(html, /<title>SPECTRA FLUX — Generative Motion Atlas<\/title>/i);
  assert.match(html, />SPECTRA FLUX<\/a>/);
  assert.match(html, /class="studio-shell"/);
  assert.match(html, /class="control-rail"/);
  assert.match(html, /class="control-rail-inner"/);
  assert.match(html, /class="gallery-panel workspace"/);
  assert.doesNotMatch(html, />LUMA LAB<\/a>/);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  assert.match(html, /一键全部随机/);
  assert.match(html, /SEVENTY-TWO GENERATIVE MOTION STUDIES/);
  assert.match(html, /七十二张卡片/);
  ["01–12", "13–24", "25–36", "37–48", "49–60", "61–72"].forEach((label) => {
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
    "02 · 横向薄纱",
    "03 · 斜向漂移",
    "04 · 急速奔流",
    "05 · 双向潮缝",
    "06 · 织带交叠",
    "07 · 剪切尾流",
    "08 · 云脊翻涌",
    "09 · 绸带塌缩",
    "10 · 丝线回声",
    "11 · 逆层卷吸",
    "12 · 雾幕呼吸",
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
  assert.match(source, /const studyNumber = String\(config\.studyId \+ 1\)/);
  assert.match(source, /const studyName = MOTION_STUDIES\[config\.studyId\]\.name/);
  assert.match(source, /key=\{config\.studyId\}/);
  assert.doesNotMatch(source, /function WebGLPreview|activeIndex|style-tabs/);
});

test("canvas resizing is deferred outside ResizeObserver delivery", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /let resizeFrame = 0;/);
  assert.match(
    source,
    /new ResizeObserver\(\(\) => \{\s*cancelAnimationFrame\(resizeFrame\);\s*resizeFrame = requestAnimationFrame\(resize\);\s*\}\)/s,
  );
  assert.match(source, /observer\.observe\(targets\[0\]\)/);
  assert.match(source, /if \(source\.width !== nextSourceWidth\)/);
  assert.match(source, /cancelAnimationFrame\(resizeFrame\);/);
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

test("SPECTRA FLUX uses a sticky left rail and responsive gallery", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.studio-shell\s*\{[^}]*grid-template-columns:\s*minmax\(280px, 320px\) minmax\(0, 848px\)/s,
  );
  assert.match(
    css,
    /\.control-rail-inner\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s,
  );
  assert.match(
    css,
    /\.control-rail-inner\s*\{[^}]*height:\s*100vh;[^}]*overflow-y:\s*auto;/s,
  );
  assert.match(
    css,
    /\.control-rail\s*\{[^}]*align-self:\s*stretch;/s,
  );
  assert.match(
    css,
    /\.intro h1\s*\{[^}]*font-size:\s*clamp\(46px, 3\.5vw, 48px\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 1100px\)[\s\S]*\.studio-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 848px\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 1100px\)[\s\S]*\.control-rail-inner\s*\{[^}]*position:\s*static/,
  );
});

test("the SPECTRA FLUX wordmark keeps a compact pixel accent", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.brand\s*\{[^}]*background:\s*none;/s);
  assert.match(
    css,
    /\.brand::before\s*\{[^}]*radial-gradient\(circle, var\(--ink\) 1px, transparent 1\.2px\)/s,
  );
});

test("the Cloudflare build keeps custom and workers.dev routes", async () => {
  const config = JSON.parse(
    await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"),
  );

  assert.equal(config.name, "spectra-flux");
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.routes, [
    {
      pattern: "spectra.8538690.xyz",
      custom_domain: true,
    },
  ]);
});

test("the lab preview uses one context, one canvas, and integrated clocks", async () => {
  const source = await readFile(
    new URL("../app/lab/lab-preview.tsx", import.meta.url),
    "utf8",
  );

  assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
  assert.equal((source.match(/<canvas/g) || []).length, 1);
  assert.match(source, /advancePhaseTimes\(/);
  assert.match(source, /uniform1fv\(uniforms\.layerTimes/);
  assert.match(
    source,
    /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/,
  );
  assert.match(source, /if \(document\.hidden\) return;/);
  assert.doesNotMatch(
    source,
    /createFramebuffer|drawImage|getContext\("2d"/,
  );
});

test("server-renders the single-card random mix lab", async () => {
  const response = await render("/lab");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /随机实验室/);
  assert.match(html, /选择效果数量/);
  assert.match(html, /一键随机创作/);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  [2, 3, 4, 5, 6].forEach((count) => {
    assert.match(html, new RegExp(`>${count}<`));
  });
  assert.equal((html.match(/<canvas/g) || []).length, 1);
  assert.equal(
    (html.match(/class="preview-card lab-preview-card"/g) || []).length,
    1,
  );
  assert.match(html, /class="lab-recipe"/);
});

test("the gallery links to the random mix lab", async () => {
  const response = await render("/");
  const html = await response.text();

  assert.match(html, /href="\/lab"[^>]*>随机实验室</);
});

test("the lab layout keeps one 400 by 100 card and accessible controls", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.lab-shell\s*\{/);
  assert.match(css, /\.effect-count\s*\{/);
  assert.match(css, /\.lab-preview-card\s*\{[^}]*--card-width:\s*400px;[^}]*--card-height:\s*100px;/s);
  assert.match(css, /\.effect-count button\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.lab-recipe\s*\{/);
  assert.match(
    css,
    /@media \(max-width: 430px\)[\s\S]*\.lab-card-stage\s*\{[^}]*width:\s*100%/,
  );
});
