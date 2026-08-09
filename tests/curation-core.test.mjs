import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LAB_SETTINGS,
  createLabRecipe,
} from "../app/lab/lab-core.ts";
import {
  EMPTY_CURATION_STATE,
  addShowcaseEntry,
  deleteStudy,
  normalizeCurationState,
  parseCurationState,
  recipeFingerprint,
  removeShowcaseEntry,
  serializeCurationState,
} from "../app/curation/curation-core.ts";

const recipe = createLabRecipe(DEFAULT_LAB_SETTINGS, 99);
assert.ok(recipe);

test("deletion is literal but does not mutate saved entries", () => {
  const added = addShowcaseEntry(EMPTY_CURATION_STATE, {
    id: "entry-1",
    createdAt: 10,
    source: "lab",
    recipe,
  });
  assert.equal(added.added, true);
  const deleted = deleteStudy(added.state, recipe.layers[0].studyId);
  assert.ok(deleted.deletedStudyIds.includes(recipe.layers[0].studyId));
  assert.equal(deleted.showcase.length, 1);
  assert.equal(removeShowcaseEntry(deleted, "entry-1").showcase.length, 0);
});

test("exact recipes deduplicate while changed recipes remain addable", () => {
  const first = addShowcaseEntry(EMPTY_CURATION_STATE, {
    id: "entry-1",
    createdAt: 10,
    source: "lab",
    recipe,
  });
  const duplicate = addShowcaseEntry(first.state, {
    id: "entry-2",
    createdAt: 20,
    source: "lab",
    recipe,
  });
  assert.equal(duplicate.added, false);
  assert.equal(duplicate.state.showcase.length, 1);

  const changed = structuredClone(recipe);
  changed.seed += 1;
  assert.notEqual(recipeFingerprint(recipe), recipeFingerprint(changed));
  const second = addShowcaseEntry(first.state, {
    id: "entry-3",
    createdAt: 30,
    source: "lab",
    recipe: changed,
  });
  assert.equal(second.added, true);
  assert.deepEqual(second.state.showcase.map(({ id }) => id), ["entry-3", "entry-1"]);
});

test("malformed serialized state is rejected and valid state is normalized", () => {
  assert.equal(parseCurationState("{"), null);
  assert.equal(parseCurationState(JSON.stringify({ version: 3 })), null);
  const parsed = parseCurationState(
    JSON.stringify({
      version: 1,
      deletedStudyIds: [3, 3, -1, 999],
      showcase: [],
      extra: true,
    }),
  );
  assert.deepEqual(parsed, {
    version: 2,
    deletedStudyIds: [3],
    showcase: [],
  });
  assert.deepEqual(
    Object.keys(JSON.parse(serializeCurationState(parsed))).sort(),
    ["deletedStudyIds", "showcase", "version"],
  );
});

test("version-one curation upgrades without dropping saved work", () => {
  const upgraded = normalizeCurationState({
    version: 1,
    deletedStudyIds: [7],
    showcase: [
      {
        id: "legacy-entry",
        createdAt: 12,
        source: "lab",
        recipe,
      },
    ],
  });

  assert.ok(upgraded);
  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.deletedStudyIds, [7]);
  assert.equal(upgraded.showcase.length, 1);
  assert.equal(upgraded.showcase[0].recipe.rhythm, "wander");
});

test("invalid entries are removed and duplicate IDs keep the newest valid entry", () => {
  const parsed = parseCurationState(
    JSON.stringify({
      version: 1,
      deletedStudyIds: [],
      showcase: [
        { id: "same", createdAt: 1, source: "lab", recipe },
        { id: "same", createdAt: 2, source: "library", recipe },
        { id: "bad", createdAt: 3, source: "elsewhere", recipe },
      ],
    }),
  );
  assert.ok(parsed);
  assert.equal(parsed.showcase.length, 1);
  assert.equal(parsed.showcase[0].createdAt, 2);
});
