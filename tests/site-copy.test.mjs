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
