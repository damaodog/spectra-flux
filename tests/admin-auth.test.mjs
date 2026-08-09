import assert from "node:assert/strict";
import test from "node:test";
import * as auth from "../worker/admin-auth.ts";

const secret = "test-secret-with-at-least-thirty-two-bytes";

const createMemoryStore = () => {
  const values = new Map();
  return {
    values,
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value, options) {
      values.set(key, value);
      values.set(`${key}:options`, options);
    },
    async delete(key) {
      values.delete(key);
    },
  };
};

test("creates verifies and expires a signed administrator session", async () => {
  const issuedAt = 1_800_000_000_000;
  const token = await auth.createSessionToken(secret, issuedAt);
  assert.deepEqual(await auth.verifySessionToken(token, secret, issuedAt + 1_000), {
    role: "admin",
    issuedAt,
  });
  assert.equal(
    await auth.verifySessionToken(`${token}x`, secret, issuedAt + 1_000),
    null,
  );
  assert.equal(
    await auth.verifySessionToken(token, secret, issuedAt + 43_200_001),
    null,
  );
});

test("compares fixed-size password digests", async () => {
  assert.equal(await auth.verifyPassword("wlh1124", "wlh1124"), true);
  assert.equal(await auth.verifyPassword("wlh1124", "wlh1125"), false);
  assert.equal(await auth.verifyPassword("short", "a much longer value"), false);
});

test("builds a secure browser-session cookie and reads it", () => {
  const cookie = auth.buildSessionCookie("signed-token");
  assert.match(cookie, /^__Host-spectra_admin=signed-token;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Path=\//);
  assert.doesNotMatch(cookie, /Expires|Max-Age/);
  const request = new Request("https://spectra.test", {
    headers: { cookie: "theme=light; __Host-spectra_admin=signed-token" },
  });
  assert.equal(auth.readCookie(request, auth.ADMIN_COOKIE_NAME), "signed-token");
  assert.match(auth.buildLogoutCookie(), /Max-Age=0/);
});

test("hashes client ids and locks the fifth failure for fifteen minutes", async () => {
  const store = createMemoryStore();
  const key = await auth.createLoginAttemptKey("198.51.100.8", secret);
  assert.match(key, /^auth:attempt:[0-9a-f]{64}$/);
  assert.doesNotMatch(key, /198\.51\.100\.8/);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await auth.isLoginAllowed(store, key, 20_000 + attempt), true);
    await auth.recordLoginFailure(store, key, 20_000 + attempt);
  }
  assert.equal(await auth.isLoginAllowed(store, key, 25_000), false);
  assert.deepEqual(store.values.get(`${key}:options`), { expirationTtl: 900 });
  assert.equal(await auth.isLoginAllowed(store, key, 920_001), true);
  await auth.clearLoginFailures(store, key);
  assert.equal(store.values.has(key), false);
});
