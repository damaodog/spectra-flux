"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LabRecipe } from "../lab/lab-core";
import {
  CURATION_EVENT,
  CURATION_STORAGE_KEY,
  EMPTY_CURATION_STATE,
  addShowcaseEntry,
  deleteStudy as deleteStudyFromState,
  normalizeCurationState,
  parseCurationState,
  removeShowcaseEntry,
  serializeCurationState,
  type CurationState,
} from "./curation-core";

export type CurationController = {
  state: CurationState;
  hydrated: boolean;
  warning: string | null;
  add(source: "library" | "lab", recipe: LabRecipe): boolean;
  remove(entryId: string): void;
  deleteStudy(studyId: number): void;
  exportJson(): string;
};

const freshEmptyState = (): CurationState => ({
  version: 1,
  deletedStudyIds: [],
  showcase: [],
});

export function useCuration(): CurationController {
  const [state, setState] = useState<CurationState>(freshEmptyState);
  const [hydrated, setHydrated] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const stateRef = useRef<CurationState>(EMPTY_CURATION_STATE);

  const receive = useCallback((next: unknown) => {
    const normalized = normalizeCurationState(next);
    if (!normalized) return false;
    stateRef.current = normalized;
    setState(normalized);
    return true;
  }, []);

  const commit = useCallback((next: CurationState) => {
    const normalized = normalizeCurationState(next);
    if (!normalized) return;
    stateRef.current = normalized;
    setState(normalized);
    try {
      window.localStorage.setItem(
        CURATION_STORAGE_KEY,
        serializeCurationState(normalized),
      );
      setWarning(null);
    } catch {
      setWarning("仅本次会话保存");
    }
    window.dispatchEvent(
      new CustomEvent(CURATION_EVENT, { detail: normalized }),
    );
  }, []);

  useEffect(() => {
    let active = true;
    const onCuration = (event: Event) => {
      receive((event as CustomEvent).detail);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== CURATION_STORAGE_KEY) return;
      if (event.newValue === null) {
        receive(freshEmptyState());
        return;
      }
      const parsed = parseCurationState(event.newValue);
      if (parsed) receive(parsed);
      else setWarning("策展数据无法读取");
    };
    window.addEventListener(CURATION_EVENT, onCuration);
    window.addEventListener("storage", onStorage);
    queueMicrotask(() => {
      if (!active) return;
      try {
        const serialized = window.localStorage.getItem(CURATION_STORAGE_KEY);
        if (serialized !== null) {
          const parsed = parseCurationState(serialized);
          if (parsed) receive(parsed);
          else setWarning("策展数据无法读取");
        }
      } catch {
        setWarning("仅本次会话保存");
      }
      setHydrated(true);
    });
    return () => {
      active = false;
      window.removeEventListener(CURATION_EVENT, onCuration);
      window.removeEventListener("storage", onStorage);
    };
  }, [receive]);

  const add = useCallback(
    (source: "library" | "lab", recipe: LabRecipe) => {
      const result = addShowcaseEntry(stateRef.current, {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        source,
        recipe,
      });
      if (result.added) commit(result.state);
      return result.added;
    },
    [commit],
  );

  const remove = useCallback(
    (entryId: string) => commit(removeShowcaseEntry(stateRef.current, entryId)),
    [commit],
  );

  const deleteStudy = useCallback(
    (studyId: number) => commit(deleteStudyFromState(stateRef.current, studyId)),
    [commit],
  );

  const exportJson = useCallback(
    () => serializeCurationState(stateRef.current),
    [],
  );

  return { state, hydrated, warning, add, remove, deleteStudy, exportJson };
}
