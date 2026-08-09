import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin state is server-backed and never stores the password locally", async () => {
  assert.equal(existsSync("app/admin/use-admin.ts"), true);
  const source = await readFile("app/admin/use-admin.ts", "utf8");
  assert.match(source, /\/api\/admin\/session/);
  assert.match(source, /\/api\/admin\/login/);
  assert.match(source, /\/api\/admin\/logout/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("management dialog exposes accessible login migration and logout controls", async () => {
  assert.equal(existsSync("app/admin/admin-panel.tsx"), true);
  const source = await readFile("app/admin/admin-panel.tsx", "utf8");
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /type="password"/);
  assert.match(source, /同步本机策展/);
  assert.match(source, /退出管理/);
  assert.match(source, /aria-live="polite"/);
});

test("curation hook reads shared state and only offers explicit local migration", async () => {
  const source = await readFile("app/curation/use-curation.ts", "utf8");
  assert.match(source, /createCurationApi/);
  assert.match(source, /legacyState/);
  assert.match(source, /migrateLegacy/);
  assert.match(source, /CURATION_STORAGE_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem/);
});

test("public pages expose copy while management actions require an admin session", async () => {
  const home = await readFile("app/page.tsx", "utf8");
  const recipeAtlas = await readFile("app/render/recipe-atlas.tsx", "utf8");
  const library = await readFile("app/library/page.tsx", "utf8");
  const lab = await readFile("app/lab/page.tsx", "utf8");
  assert.match(home, /<AdminPanel/);
  assert.match(home, /admin\.authenticated \?/);
  assert.match(recipeAtlas, /CopyEmbedButton/);
  assert.match(library, /admin\.authenticated/);
  assert.match(lab, /admin\.authenticated/);
  assert.match(lab, /CopyEmbedButton/);
});

test("embed copy has a production-safe origin and a manual clipboard fallback", async () => {
  assert.equal(existsSync("app/embed/copy-embed-button.tsx"), true);
  const source = await readFile("app/embed/copy-embed-button.tsx", "utf8");
  assert.match(source, /https:\/\/spectra\.8538690\.xyz/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /readOnly/);
  assert.match(source, /复制 HTML/);
});

test("random lab includes five advanced constraint groups", async () => {
  const source = await readFile("app/lab/page.tsx", "utf8");
  assert.match(source, /更多随机约束/);
  for (const label of ["互动方式", "节奏方式", "构图方式", "视觉密度", "边缘质感"]) {
    assert.match(source, new RegExp(label));
  }
});
