export const ADMIN_COOKIE_NAME = "__Host-spectra_admin";
export const SESSION_MAX_AGE_MS = 43_200_000;
const LOGIN_WINDOW_MS = 900_000;
const MAX_LOGIN_FAILURES = 5;

type AttemptStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

type SessionPayload = {
  role: "admin";
  issuedAt: number;
  nonce: string;
};

type TimingSafeSubtle = SubtleCrypto & {
  timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean;
};

const encoder = new TextEncoder();
const subtle = crypto.subtle as TimingSafeSubtle;

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const textToBase64Url = (text: string) =>
  bytesToBase64Url(encoder.encode(text));

const base64UrlToBytes = (value: string) => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const base64UrlToText = (value: string) =>
  new TextDecoder().decode(base64UrlToBytes(value));

const importHmacKey = (secret: string) =>
  subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const constantTimeEqual = (left: ArrayBuffer, right: ArrayBuffer) => {
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(left, right);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
};

export async function verifyPassword(candidate: string, expected: string) {
  const [candidateHash, expectedHash] = await Promise.all([
    subtle.digest("SHA-256", encoder.encode(candidate)),
    subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  return constantTimeEqual(candidateHash, expectedHash);
}

export async function createSessionToken(secret: string, now = Date.now()) {
  const nonce = new Uint8Array(16);
  crypto.getRandomValues(nonce);
  const payload = textToBase64Url(
    JSON.stringify({
      role: "admin",
      issuedAt: now,
      nonce: bytesToBase64Url(nonce),
    } satisfies SessionPayload),
  );
  const key = await importHmacKey(secret);
  const signature = await subtle.sign("HMAC", key, encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  now = Date.now(),
): Promise<{ role: "admin"; issuedAt: number } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
      return null;
    }
    const [payload, signature] = parts;
    const key = await importHmacKey(secret);
    const valid = await subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const parsed = JSON.parse(base64UrlToText(payload)) as Partial<SessionPayload>;
    if (
      parsed.role !== "admin" ||
      typeof parsed.issuedAt !== "number" ||
      !Number.isFinite(parsed.issuedAt) ||
      typeof parsed.nonce !== "string" ||
      parsed.issuedAt > now + 60_000 ||
      now - parsed.issuedAt > SESSION_MAX_AGE_MS
    ) {
      return null;
    }
    return { role: "admin", issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export const buildSessionCookie = (token: string) =>
  `${ADMIN_COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`;

export const buildLogoutCookie = () =>
  `${ADMIN_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

export async function createLoginAttemptKey(ip: string, secret: string) {
  const key = await importHmacKey(secret);
  const digest = await subtle.sign("HMAC", key, encoder.encode(ip));
  return `auth:attempt:${Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("")}`;
}

const readAttempt = async (store: Pick<AttemptStore, "get">, key: string) => {
  try {
    const value = await store.get(key);
    if (!value) return null;
    const parsed = JSON.parse(value) as { count?: unknown; firstAt?: unknown };
    return Number.isInteger(parsed.count) &&
      typeof parsed.firstAt === "number" &&
      Number.isFinite(parsed.firstAt)
      ? { count: parsed.count as number, firstAt: parsed.firstAt }
      : null;
  } catch {
    return null;
  }
};

export async function isLoginAllowed(
  store: Pick<AttemptStore, "get">,
  key: string,
  now = Date.now(),
) {
  const attempt = await readAttempt(store, key);
  return (
    !attempt ||
    now - attempt.firstAt >= LOGIN_WINDOW_MS ||
    attempt.count < MAX_LOGIN_FAILURES
  );
}

export async function recordLoginFailure(
  store: Pick<AttemptStore, "get" | "put">,
  key: string,
  now = Date.now(),
) {
  const previous = await readAttempt(store, key);
  const active = previous && now - previous.firstAt < LOGIN_WINDOW_MS;
  const attempt = {
    count: active ? previous.count + 1 : 1,
    firstAt: active ? previous.firstAt : now,
  };
  await store.put(key, JSON.stringify(attempt), { expirationTtl: 900 });
}

export const clearLoginFailures = (
  store: Pick<AttemptStore, "delete">,
  key: string,
) => store.delete(key);
