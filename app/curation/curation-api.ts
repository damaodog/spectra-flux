import type { LabRecipe } from "../lab/lab-core.ts";
import {
  normalizeCurationState,
  type CurationState,
} from "./curation-core.ts";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class CurationApiError extends Error {
  code: string;
  state: CurationState | null;

  constructor(code: string, state: CurationState | null = null) {
    super(code);
    this.name = "CurationApiError";
    this.code = code;
    this.state = state;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function createCurationApi(fetcher: Fetcher = fetch) {
  const request = async (path: string, init: RequestInit = {}) => {
    let response: Response;
    try {
      response = await fetcher(path, {
        ...init,
        credentials: "same-origin",
        headers: {
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
    } catch {
      throw new CurationApiError("NETWORK_ERROR");
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CurationApiError("INVALID_RESPONSE");
    }
    if (!isRecord(body)) throw new CurationApiError("INVALID_RESPONSE");
    const data = isRecord(body.data) ? body.data : null;
    const state = data ? normalizeCurationState(data.state) : null;
    if (!response.ok || body.ok !== true) {
      const error = isRecord(body.error) ? body.error : null;
      throw new CurationApiError(
        typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
        state,
      );
    }
    if (!data || !state) throw new CurationApiError("INVALID_RESPONSE");
    return { ...data, state };
  };

  return {
    read: () => request("/api/curation"),
    addShowcase: (source: "library" | "lab", recipe: LabRecipe) =>
      request("/api/showcase", {
        method: "POST",
        body: JSON.stringify({ source, recipe }),
      }),
    removeShowcase: (id: string) =>
      request(`/api/showcase/${encodeURIComponent(id)}`, { method: "DELETE" }),
    deleteStudy: (studyId: number) =>
      request(`/api/studies/${studyId}`, { method: "DELETE" }),
    importLocal: (state: CurationState) =>
      request("/api/curation/import-local", {
        method: "POST",
        body: JSON.stringify({ state }),
      }),
  };
}
