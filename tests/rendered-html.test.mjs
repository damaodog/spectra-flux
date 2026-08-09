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
      CURATION_KV: {
        async get() { return null; },
        async put() {},
        async delete() {},
      },
      SPECTRA_ADMIN_PASSWORD: "test-password",
      SPECTRA_SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("built worker routes curation API before the page handler", async () => {
  const response = await render("/api/curation");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      state: { version: 2, deletedStudyIds: [], showcase: [] },
    },
  });
});

test("server-renders shared curation as loading before hydration", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(html, /<title>SPECTRA FLUX — Generative Motion Studio<\/title>/i);
  assert.match(html, /144 种 WebGL 单效果/);
  assert.match(html, />SPECTRA FLUX<\/a>/);
  assert.match(html, /class="studio-shell"/);
  assert.match(html, /class="control-rail"/);
  assert.match(html, /class="control-rail-inner"/);
  assert.match(html, /class="gallery-panel workspace"/);
  assert.match(html, /策展首页/);
  assert.match(html, /正在加载共享作品/);
  assert.match(html, /class="showcase-loading"/);
  assert.doesNotMatch(html, /尚未添加动态作品/);
  assert.match(html, />管理</);
  assert.doesNotMatch(html, /导出策展配置/);
  assert.match(html, /href="\/library"/);
  assert.match(html, /href="\/lab"/);
  assert.equal((html.match(/<canvas/g) || []).length, 0);
  assert.doesNotMatch(html, /一键全部随机/);
  assert.match(css, /\.showcase-loading\s*\{/);
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.showcase-loading::after/,
  );
});

test("curated homepage paginates shared recipes and gates management controls", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /useCuration\(\)/);
  assert.match(source, /state\.showcase\.slice/);
  assert.match(source, /exportJson\(\)/);
  assert.match(source, /new Blob\(/);
  assert.match(source, /URL\.createObjectURL\(/);
  assert.match(source, /URL\.revokeObjectURL\(/);
  assert.match(source, /admin\.authenticated/);
  assert.match(source, /onRemove=\{admin\.authenticated \? removeFromHome : undefined\}/);
});

test("the gallery shares one WebGL atlas across twelve 2D canvases", async () => {
  const source = await readFile(new URL("../app/render/atomic-atlas.tsx", import.meta.url), "utf8");

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
  assert.match(source, /Math\.min\(window\.devicePixelRatio \|\| 1, 1\.5\)/);
  assert.match(source, /const studyNumber = String\(config\.studyId \+ 1\)/);
  assert.match(source, /MOTION_STUDIES\.find/);
  assert.match(source, /key=\{config\.studyId\}/);
  assert.doesNotMatch(source, /function WebGLPreview|activeIndex|style-tabs/);
});

test("canvas resizing is deferred outside ResizeObserver delivery", async () => {
  const source = await readFile(new URL("../app/render/atomic-atlas.tsx", import.meta.url), "utf8");

  assert.match(source, /let resizeFrame = 0;/);
  assert.match(
    source,
    /new ResizeObserver\(\(\) => \{\s*cancelAnimationFrame\(resizeFrame\);\s*resizeFrame = requestAnimationFrame\(resize\);\s*\}\)/s,
  );
  assert.match(source, /observer\.observe\(targets\[0\]\)/);
  assert.match(source, /if \(source\.width !== sourceWidth\)/);
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

test("curated cards use compact rows and ten-pixel corners", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const library = await readFile(new URL("../app/library/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/lab/page.tsx", import.meta.url), "utf8");
  const recipes = await readFile(new URL("../app/render/recipe-atlas.tsx", import.meta.url), "utf8");
  const embed = await readFile(new URL("../app/embed/embed-card.tsx", import.meta.url), "utf8");

  assert.match(css, /\.atlas-gallery\s*\{[^}]*gap:\s*30px 48px/s);
  assert.match(css, /\.recipe-atlas \.card-study\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.recipe-atlas \.card-actions\s*\{[^}]*grid-column:\s*2/s);
  for (const source of [library, lab, recipes, embed]) {
    assert.match(source, /"--card-radius": "10px"|radius: 10/);
  }
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
  assert.deepEqual(config.kv_namespaces, [
    {
      binding: "CURATION_KV",
      id: "00000000000000000000000000000000",
    },
  ]);
  assert.deepEqual(config.secrets, {
    required: ["SPECTRA_ADMIN_PASSWORD", "SPECTRA_SESSION_SECRET"],
  });
});

test("server-renders the 144-effect library without visitor management actions", async () => {
  const response = await render("/library");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /一百四十四种单效果/);
  assert.match(html, /01 · 柔雾扩散/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/lab"/);
  assert.equal((html.match(/class="card-study"/g) || []).length, 12);
  assert.equal((html.match(/class="preview-card"/g) || []).length, 12);
  assert.equal((html.match(/<canvas/g) || []).length, 12);
  assert.doesNotMatch(html, />展示到首页<\/button>/);
  assert.doesNotMatch(html, />删除<\/button>/);
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
  assert.match(html, /混合强度/);
  assert.match(html, /速度下限/);
  assert.match(html, /速度上限/);
  assert.match(html, /配色方向/);
  assert.match(html, /更多随机约束/);
  assert.match(html, /互动方式/);
  assert.match(html, /节奏方式/);
  assert.match(html, /构图方式/);
  assert.match(html, /视觉密度/);
  assert.match(html, /边缘质感/);
  assert.match(html, /柔和/);
  assert.match(html, /均衡/);
  assert.match(html, /激烈/);
  assert.doesNotMatch(html, /展示到首页/);
  assert.match(html, /复制 HTML/);
  assert.match(html, /一键随机创作/);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  [1, 2, 3, 4, 5, 6].forEach((count) => {
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

test("curation and lab controls keep the restrained responsive visual system", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.card-actions\s*\{[^}]*display:\s*flex;/s);
  assert.match(css, /\.card-actions button\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.danger-action\s*\{/);
  assert.match(css, /\.empty-showcase\s*\{/);
  assert.match(css, /\.lab-settings\s*\{/);
  assert.match(css, /\.mix-intensity button\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.speed-bounds\s*\{/);
  assert.match(css, /\.palette-direction select\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.recipe-summary\s*\{/);
  assert.match(
    css,
    /\.effect-count > div\s*\{[^}]*grid-template-columns:\s*repeat\(6,\s*1fr\)/s,
  );
  assert.match(
    css,
    /@media \(max-width: 760px\)[\s\S]*\.empty-showcase\s*\{[^}]*padding:/,
  );
});
