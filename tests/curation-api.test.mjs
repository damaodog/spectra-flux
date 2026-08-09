import assert from "node:assert/strict";
import test from "node:test";
import { createLabRecipe, DEFAULT_LAB_SETTINGS } from "../app/lab/lab-core.ts";
import * as curationApi from "../app/curation/curation-api.ts";

const recipe = createLabRecipe(DEFAULT_LAB_SETTINGS, 81);
assert.ok(recipe);
const state = { version: 2, deletedStudyIds: [], showcase: [] };

test("sends a same-origin credentialed showcase addition", async () => {
  const calls = [];
  const api = curationApi.createCurationApi(async (input, init) => {
    calls.push([input, init]);
    return Response.json({ ok: true, data: { state, added: true } });
  });

  const result = await api.addShowcase("lab", recipe);
  assert.deepEqual(result, { state, added: true });
  assert.equal(calls[0][0], "/api/showcase");
  assert.equal(calls[0][1].method, "POST");
  assert.equal(calls[0][1].credentials, "same-origin");
  assert.equal(calls[0][1].cache, "no-store");
  assert.deepEqual(JSON.parse(calls[0][1].body), { source: "lab", recipe });
});

test("uses exact endpoints for reads deletes and local imports", async () => {
  const calls = [];
  const api = curationApi.createCurationApi(async (input, init = {}) => {
    calls.push([input, init]);
    return Response.json({ ok: true, data: { state } });
  });

  await api.read();
  await api.removeShowcase("entry with space");
  await api.deleteStudy(17);
  await api.importLocal(state);
  assert.deepEqual(
    calls.map(([input, init]) => [input, init.method ?? "GET"]),
    [
      ["/api/curation", "GET"],
      ["/api/showcase/entry%20with%20space", "DELETE"],
      ["/api/studies/17", "DELETE"],
      ["/api/curation/import-local", "POST"],
    ],
  );
});

test("surfaces stable API error codes and safe fallback state", async () => {
  const api = curationApi.createCurationApi(async () =>
    Response.json(
      {
        ok: false,
        data: { state },
        error: { code: "CURATION_CORRUPT", requestId: "request-1" },
      },
      { status: 500 },
    ),
  );

  await assert.rejects(() => api.read(), (error) => {
    assert.equal(error.name, "CurationApiError");
    assert.equal(error.code, "CURATION_CORRUPT");
    assert.deepEqual(error.state, state);
    return true;
  });
});
