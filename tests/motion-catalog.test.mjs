import assert from "node:assert/strict";
import test from "node:test";
import {
  MOTION_CHAPTERS,
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
  getMotionPage,
} from "../app/motion-catalog.ts";

test("catalog exposes twelve stable chapters and 144 consecutive studies", () => {
  assert.equal(MOTION_PAGE_SIZE, 12);
  assert.equal(MOTION_CHAPTERS.length, 12);
  assert.equal(MOTION_STUDIES.length, 144);
  assert.deepEqual(
    MOTION_STUDIES.map(({ id }) => id),
    Array.from({ length: 144 }, (_, id) => id),
  );
  assert.equal(new Set(MOTION_STUDIES.map(({ name }) => name)).size, 144);
  MOTION_CHAPTERS.forEach((chapter, index) => {
    assert.equal(chapter.index, index);
    assert.equal(chapter.startId, index * 12);
    assert.equal(getMotionPage(index).length, 12);
  });
  assert.deepEqual(getMotionPage(-1), []);
  assert.deepEqual(getMotionPage(12), []);
});

test("new study names and chapter boundaries are fixed", () => {
  assert.equal(MOTION_STUDIES[72].name, "汞面汇流");
  assert.equal(MOTION_STUDIES[83].name, "反光潮汐");
  assert.equal(MOTION_STUDIES[84].name, "细胞分裂");
  assert.equal(MOTION_STUDIES[107].name, "板块碰撞");
  assert.equal(MOTION_STUDIES[120].name, "莫比乌斯扭转");
  assert.equal(MOTION_STUDIES[143].name, "状态跃迁");
});
