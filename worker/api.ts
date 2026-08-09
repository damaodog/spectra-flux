import {
  EMPTY_CURATION_STATE,
  addShowcaseEntry,
  deleteStudy,
  normalizeCurationState,
  normalizeRecipe,
  parseCurationState,
  removeShowcaseEntry,
  serializeCurationState,
  type CurationState,
} from "../app/curation/curation-core.ts";
import {
  ADMIN_COOKIE_NAME,
  buildLogoutCookie,
  buildSessionCookie,
  clearLoginFailures,
  createLoginAttemptKey,
  createSessionToken,
  isLoginAllowed,
  readCookie,
  recordLoginFailure,
  verifyPassword,
  verifySessionToken,
} from "./admin-auth.ts";

export type SpectraApiEnv = Cloudflare.Env;

const CURATION_KEY = "curation:v2";
const MAX_BODY_BYTES = 256 * 1024;

const responseHeaders = (cacheControl = "no-store") => ({
  "cache-control": cacheControl,
  "content-type": "application/json; charset=utf-8",
});

const success = <T>(data: T, init: ResponseInit = {}) =>
  Response.json(
    { ok: true, data },
    {
      ...init,
      headers: {
        ...responseHeaders(),
        ...init.headers,
      },
    },
  );

const failure = <T = never>(
  code: string,
  status: number,
  data?: T,
) =>
  Response.json(
    {
      ok: false,
      ...(data === undefined ? {} : { data }),
      error: { code, requestId: crypto.randomUUID() },
    },
    { status, headers: responseHeaders() },
  );

const readJson = async (request: Request) => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { error: "BODY_TOO_LARGE" } as const;
  }
  if (!request.body) return { value: null } as const;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      return { error: "BODY_TOO_LARGE" } as const;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) as unknown } as const;
  } catch {
    return { error: "INVALID_JSON" } as const;
  }
};

const requireJson = async (request: Request) => {
  const result = await readJson(request);
  if ("error" in result && result.error) {
    return result.error === "BODY_TOO_LARGE"
      ? failure(result.error, 413)
      : failure(result.error, 400);
  }
  return result;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const originIsValid = (request: Request) =>
  request.headers.get("origin") === new URL(request.url).origin;

const readSharedState = async (
  env: SpectraApiEnv,
): Promise<{ state: CurationState; error?: "CURATION_CORRUPT" }> => {
  const serialized = await env.CURATION_KV.get(CURATION_KEY);
  if (serialized === null) {
    return { state: EMPTY_CURATION_STATE } as const;
  }
  const state = parseCurationState(serialized);
  return state
    ? ({ state } as const)
    : ({ state: EMPTY_CURATION_STATE, error: "CURATION_CORRUPT" } as const);
};

const writeSharedState = async (env: SpectraApiEnv, state: CurationState) => {
  const normalized = normalizeCurationState(state) ?? EMPTY_CURATION_STATE;
  await env.CURATION_KV.put(CURATION_KEY, serializeCurationState(normalized));
  return normalized;
};

const hasAdminSession = async (request: Request, env: SpectraApiEnv) => {
  const token = readCookie(request, ADMIN_COOKIE_NAME);
  return token
    ? Boolean(await verifySessionToken(token, env.SPECTRA_SESSION_SECRET))
    : false;
};

const requireMutationAccess = async (
  request: Request,
  env: SpectraApiEnv,
) => {
  if (!originIsValid(request)) return failure("ORIGIN_FORBIDDEN", 403);
  return (await hasAdminSession(request, env))
    ? null
    : failure("SESSION_REQUIRED", 401);
};

const stateOrError = async (env: SpectraApiEnv) => {
  const result = await readSharedState(env);
  return result.error
    ? { response: failure(result.error, 500, { state: result.state }) }
    : result;
};

export async function handleApiRequest(
  request: Request,
  env: SpectraApiEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;

  if (request.method === "GET" && url.pathname === "/api/curation") {
    const result = await readSharedState(env);
    if (result.error) {
      return failure(result.error, 500, { state: result.state });
    }
    return success(
      { state: result.state },
      { headers: responseHeaders("public, max-age=15, stale-while-revalidate=60") },
    );
  }

  if (request.method === "GET" && url.pathname === "/api/admin/session") {
    return success({ authenticated: await hasAdminSession(request, env) });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    if (!originIsValid(request)) return failure("ORIGIN_FORBIDDEN", 403);
    const body = await requireJson(request);
    if (body instanceof Response) return body;
    if (!isRecord(body.value) || typeof body.value.password !== "string") {
      return failure("INVALID_INPUT", 400);
    }
    const clientKey = await createLoginAttemptKey(
      request.headers.get("cf-connecting-ip") ?? "local-development",
      env.SPECTRA_SESSION_SECRET,
    );
    if (!(await isLoginAllowed(env.CURATION_KV, clientKey))) {
      return failure("LOGIN_THROTTLED", 429);
    }
    if (!(await verifyPassword(body.value.password, env.SPECTRA_ADMIN_PASSWORD))) {
      await recordLoginFailure(env.CURATION_KV, clientKey);
      return failure("INVALID_PASSWORD", 401);
    }
    await clearLoginFailures(env.CURATION_KV, clientKey);
    const token = await createSessionToken(env.SPECTRA_SESSION_SECRET);
    return success(
      { authenticated: true },
      { headers: { "set-cookie": buildSessionCookie(token) } },
    );
  }

  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    const denied = await requireMutationAccess(request, env);
    if (denied) return denied;
    return success(
      { authenticated: false },
      { headers: { "set-cookie": buildLogoutCookie() } },
    );
  }

  const writeRoute =
    url.pathname === "/api/showcase" ||
    url.pathname.startsWith("/api/showcase/") ||
    url.pathname.startsWith("/api/studies/") ||
    url.pathname === "/api/curation/import-local";
  if (writeRoute) {
    const denied = await requireMutationAccess(request, env);
    if (denied) return denied;
  }

  if (request.method === "POST" && url.pathname === "/api/showcase") {
    const body = await requireJson(request);
    if (body instanceof Response) return body;
    if (!isRecord(body.value)) return failure("INVALID_INPUT", 400);
    const recipe = normalizeRecipe(body.value.recipe);
    if (
      !recipe ||
      (body.value.source !== "library" && body.value.source !== "lab")
    ) {
      return failure("INVALID_INPUT", 400);
    }
    const current = await stateOrError(env);
    if ("response" in current) return current.response;
    const result = addShowcaseEntry(current.state, {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      source: body.value.source,
      recipe,
    });
    const state = result.added
      ? await writeSharedState(env, result.state)
      : current.state;
    return success({ state, added: result.added });
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/showcase/")) {
    const id = decodeURIComponent(url.pathname.slice("/api/showcase/".length));
    if (!id || id.length > 128) return failure("INVALID_INPUT", 400);
    const current = await stateOrError(env);
    if ("response" in current) return current.response;
    const next = removeShowcaseEntry(current.state, id);
    const state =
      next.showcase.length === current.state.showcase.length
        ? current.state
        : await writeSharedState(env, next);
    return success({ state });
  }

  if (request.method === "DELETE" && url.pathname.startsWith("/api/studies/")) {
    const id = Number(url.pathname.slice("/api/studies/".length));
    if (!Number.isInteger(id) || id < 0 || id >= 144) {
      return failure("INVALID_INPUT", 400);
    }
    const current = await stateOrError(env);
    if ("response" in current) return current.response;
    const next = deleteStudy(current.state, id);
    const state = current.state.deletedStudyIds.includes(id)
      ? current.state
      : await writeSharedState(env, next);
    return success({ state });
  }

  if (
    request.method === "POST" &&
    url.pathname === "/api/curation/import-local"
  ) {
    const body = await requireJson(request);
    if (body instanceof Response) return body;
    const local = isRecord(body.value)
      ? normalizeCurationState(body.value.state)
      : null;
    if (!local) return failure("INVALID_INPUT", 400);
    const current = await stateOrError(env);
    if ("response" in current) return current.response;
    let merged: CurationState = {
      ...current.state,
      deletedStudyIds: [
        ...new Set([...current.state.deletedStudyIds, ...local.deletedStudyIds]),
      ].sort((left, right) => left - right),
    };
    const serverIds = new Set(merged.showcase.map(({ id }) => id));
    for (const entry of [...local.showcase].reverse()) {
      const result = addShowcaseEntry(merged, {
        ...entry,
        id: serverIds.has(entry.id) ? crypto.randomUUID() : entry.id,
      });
      merged = result.state;
    }
    return success({ state: await writeSharedState(env, merged) });
  }

  return failure("NOT_FOUND", 404);
}
