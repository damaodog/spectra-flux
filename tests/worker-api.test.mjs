import assert from "node:assert/strict";
import test from "node:test";
import { createLabRecipe, DEFAULT_LAB_SETTINGS } from "../app/lab/lab-core.ts";
import * as workerApi from "../worker/api.ts";

class MemoryKv {
  values = new Map();
  writes = [];

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async put(key, value, options) {
    this.values.set(key, value);
    this.writes.push({ key, value, options });
  }

  async delete(key) {
    this.values.delete(key);
  }
}

const createEnv = () => ({
  CURATION_KV: new MemoryKv(),
  SPECTRA_ADMIN_PASSWORD: "test-password",
  SPECTRA_SESSION_SECRET: "test-session-secret-with-at-least-32-bytes",
});

const recipe = createLabRecipe(
  { ...DEFAULT_LAB_SETTINGS, effectCount: 4, rhythm: "alternating" },
  77,
);
assert.ok(recipe);

const jsonRequest = (path, method, body, headers = {}) =>
  new Request(`https://spectra.test${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "https://spectra.test",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const login = async (env) => {
  const response = await workerApi.handleApiRequest(
    jsonRequest(
      "/api/admin/login",
      "POST",
      { password: "test-password" },
      { "cf-connecting-ip": "198.51.100.2" },
    ),
    env,
  );
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";", 1)[0];
};

test("serves safe public curation and rejects anonymous writes", async () => {
  const env = createEnv();
  const response = await workerApi.handleApiRequest(
    new Request("https://spectra.test/api/curation"),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    data: {
      state: { version: 2, deletedStudyIds: [], showcase: [] },
    },
  });

  const denied = await workerApi.handleApiRequest(
    jsonRequest("/api/showcase", "POST", { source: "lab", recipe }),
    env,
  );
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).error.code, "SESSION_REQUIRED");
});

test("logs in and applies every shared curation mutation", async () => {
  const env = createEnv();
  const cookie = await login(env);
  const headers = { cookie };

  const added = await workerApi.handleApiRequest(
    jsonRequest("/api/showcase", "POST", { source: "lab", recipe }, headers),
    env,
  );
  assert.equal(added.status, 200);
  const addedState = (await added.json()).data.state;
  assert.equal(addedState.showcase.length, 1);
  const entryId = addedState.showcase[0].id;

  const duplicate = await workerApi.handleApiRequest(
    jsonRequest("/api/showcase", "POST", { source: "lab", recipe }, headers),
    env,
  );
  assert.equal((await duplicate.json()).data.state.showcase.length, 1);

  const deletedStudy = await workerApi.handleApiRequest(
    jsonRequest(`/api/studies/${recipe.layers[0].studyId}`, "DELETE", undefined, headers),
    env,
  );
  assert.deepEqual((await deletedStudy.json()).data.state.deletedStudyIds, [
    recipe.layers[0].studyId,
  ]);

  const removed = await workerApi.handleApiRequest(
    jsonRequest(`/api/showcase/${entryId}`, "DELETE", undefined, headers),
    env,
  );
  assert.equal((await removed.json()).data.state.showcase.length, 0);

  const imported = await workerApi.handleApiRequest(
    jsonRequest(
      "/api/curation/import-local",
      "POST",
      {
        state: {
          version: 1,
          deletedStudyIds: [recipe.layers[0].studyId, 9],
          showcase: [
            { id: "legacy", createdAt: 2, source: "lab", recipe },
            { id: "legacy-copy", createdAt: 3, source: "lab", recipe },
          ],
        },
      },
      headers,
    ),
    env,
  );
  const importedState = (await imported.json()).data.state;
  assert.deepEqual(
    importedState.deletedStudyIds.sort((a, b) => a - b),
    [...new Set([recipe.layers[0].studyId, 9])].sort((a, b) => a - b),
  );
  assert.equal(importedState.showcase.length, 1);
});

test("rejects wrong origins malformed input oversized input and unknown routes", async () => {
  const env = createEnv();
  const wrongOrigin = await workerApi.handleApiRequest(
    jsonRequest(
      "/api/admin/login",
      "POST",
      { password: "test-password" },
      { origin: "https://attacker.test" },
    ),
    env,
  );
  assert.equal(wrongOrigin.status, 403);

  const malformed = await workerApi.handleApiRequest(
    new Request("https://spectra.test/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://spectra.test",
      },
      body: "{",
    }),
    env,
  );
  assert.equal(malformed.status, 400);

  const oversized = await workerApi.handleApiRequest(
    new Request("https://spectra.test/api/admin/login", {
      method: "POST",
      headers: {
        "content-length": "262145",
        "content-type": "application/json",
        origin: "https://spectra.test",
      },
      body: "{}",
    }),
    env,
  );
  assert.equal(oversized.status, 413);

  const unknown = await workerApi.handleApiRequest(
    new Request("https://spectra.test/api/unknown"),
    env,
  );
  assert.equal(unknown.status, 404);
  assert.equal(
    await workerApi.handleApiRequest(new Request("https://spectra.test/lab"), env),
    null,
  );
});

test("throttles the sixth login after five failures", async () => {
  const env = createEnv();
  const attempt = () =>
    workerApi.handleApiRequest(
      jsonRequest(
        "/api/admin/login",
        "POST",
        { password: "wrong" },
        { "cf-connecting-ip": "203.0.113.8" },
      ),
      env,
    );
  for (let index = 0; index < 5; index += 1) {
    assert.equal((await attempt()).status, 401);
  }
  const locked = await attempt();
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).error.code, "LOGIN_THROTTLED");
});

test("reports damaged KV without overwriting it", async () => {
  const env = createEnv();
  env.CURATION_KV.values.set("curation:v2", "not-json");
  const beforeWrites = env.CURATION_KV.writes.length;
  const response = await workerApi.handleApiRequest(
    new Request("https://spectra.test/api/curation"),
    env,
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, "CURATION_CORRUPT");
  assert.deepEqual(body.data.state, {
    version: 2,
    deletedStudyIds: [],
    showcase: [],
  });
  assert.equal(env.CURATION_KV.writes.length, beforeWrites);
});
