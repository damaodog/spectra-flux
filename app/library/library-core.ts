import {
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
  type MotionStudy,
} from "../motion-catalog.ts";

export const getActiveStudies = (deletedStudyIds: readonly number[]) => {
  const deleted = new Set(
    deletedStudyIds.filter(
      (id) => Number.isInteger(id) && id >= 0 && id < MOTION_STUDIES.length,
    ),
  );
  return MOTION_STUDIES.filter(({ id }) => !deleted.has(id));
};

export const getLibraryPage = (
  studies: readonly MotionStudy[],
  pageIndex: number,
) => {
  const page = Math.max(0, Math.trunc(pageIndex));
  const start = page * MOTION_PAGE_SIZE;
  return studies.slice(start, start + MOTION_PAGE_SIZE);
};
