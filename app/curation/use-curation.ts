"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SPECTRA_ADMIN_SESSION_EVENT } from "../admin/use-admin";
import type { LabRecipe } from "../lab/lab-core";
import { createCurationApi, CurationApiError } from "./curation-api";
import {
  CURATION_STORAGE_KEY,
  EMPTY_CURATION_STATE,
  parseCurationState,
  serializeCurationState,
  type CurationState,
} from "./curation-core";

export type CurationController = {
  state: CurationState;
  hydrated: boolean;
  saving: boolean;
  warning: string | null;
  legacyState: CurationState | null;
  add(source: "library" | "lab", recipe: LabRecipe): Promise<boolean>;
  remove(entryId: string): Promise<void>;
  deleteStudy(studyId: number): Promise<void>;
  migrateLegacy(): Promise<void>;
  refresh(): Promise<void>;
  exportJson(): string;
};

const api = createCurationApi();
const freshEmptyState = (): CurationState => ({
  ...EMPTY_CURATION_STATE,
  deletedStudyIds: [],
  showcase: [],
});

const messageForError = (code: string) => {
  if (code === "NETWORK_ERROR") return "网络连接失败，当前内容未改变";
  if (code === "CURATION_CORRUPT") return "共享策展暂时无法读取，请稍后重试";
  if (code === "SESSION_REQUIRED") return "管理会话已失效，请重新登录";
  return "操作失败，当前内容未改变";
};

export function useCuration(): CurationController {
  const [state, setState] = useState<CurationState>(freshEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [legacyState, setLegacyState] = useState<CurationState | null>(null);
  const stateRef = useRef<CurationState>(EMPTY_CURATION_STATE);

  const receive = useCallback((next: CurationState) => {
    stateRef.current = next;
    setState(next);
    setWarning(null);
  }, []);

  const receiveError = useCallback((error: unknown) => {
    if (error instanceof CurationApiError) {
      if (error.state) {
        stateRef.current = error.state;
        setState(error.state);
      }
      if (error.code === "SESSION_REQUIRED") {
        window.dispatchEvent(new Event(SPECTRA_ADMIN_SESSION_EVENT));
      }
      setWarning(messageForError(error.code));
      return;
    }
    setWarning(messageForError("REQUEST_FAILED"));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await api.read();
      receive(result.state);
    } catch (error) {
      receiveError(error);
    } finally {
      setHydrated(true);
    }
  }, [receive, receiveError]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const serialized = window.localStorage.getItem(CURATION_STORAGE_KEY);
        const parsed = serialized ? parseCurationState(serialized) : null;
        if (parsed && (parsed.showcase.length > 0 || parsed.deletedStudyIds.length > 0)) {
          setLegacyState(parsed);
        }
      } catch {
        setWarning("无法读取本机旧策展，但共享首页不受影响");
      }
      void refresh();
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const mutate = useCallback(
    async (operation: () => Promise<{ state: CurationState }>) => {
      setSaving(true);
      try {
        const result = await operation();
        receive(result.state);
        return result;
      } catch (error) {
        receiveError(error);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [receive, receiveError],
  );

  const add = useCallback(
    async (source: "library" | "lab", recipe: LabRecipe) => {
      const result = await mutate(() => api.addShowcase(source, recipe));
      return Boolean(result?.added);
    },
    [mutate],
  );

  const remove = useCallback(
    async (entryId: string) => {
      await mutate(() => api.removeShowcase(entryId));
    },
    [mutate],
  );

  const deleteStudy = useCallback(
    async (studyId: number) => {
      await mutate(() => api.deleteStudy(studyId));
    },
    [mutate],
  );

  const migrateLegacy = useCallback(async () => {
    if (!legacyState) return;
    const result = await mutate(() => api.importLocal(legacyState));
    if (!result) return;
    try {
      window.localStorage.removeItem(CURATION_STORAGE_KEY);
    } catch {
      // The server copy is already safe; a blocked local removal is harmless.
    }
    setLegacyState(null);
  }, [legacyState, mutate]);

  const exportJson = useCallback(() => serializeCurationState(stateRef.current), []);

  return {
    state,
    hydrated,
    saving,
    warning,
    legacyState,
    add,
    remove,
    deleteStudy,
    migrateLegacy,
    refresh,
    exportJson,
  };
}
