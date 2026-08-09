import assert from "node:assert/strict";
import test from "node:test";
import {
  getActiveStudies,
  getLibraryPage,
} from "../app/library/library-core.ts";

test("deleted studies disappear and pagination compacts", () => {
  const active = getActiveStudies([0, 5, 5, 143]);
  assert.equal(active.length, 141);
  assert.equal(active[0].id, 1);
  assert.equal(active[4].id, 6);
  assert.equal(getLibraryPage(active, 0).length, 12);
  assert.equal(getLibraryPage(active, 11).length, 9);
  assert.deepEqual(getLibraryPage(active, 12), []);
});

test("invalid deletions are ignored and negative pages use page zero", () => {
  const active = getActiveStudies([-1, 1.5, 144, Number.NaN]);
  assert.equal(active.length, 144);
  assert.deepEqual(getLibraryPage(active, -2), active.slice(0, 12));
});
