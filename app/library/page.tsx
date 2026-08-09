"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext production RSC navigation is broken; native anchors are intentional. */

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "../admin/use-admin";
import {
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  createGallery,
  type CardConfig,
} from "../card-core";
import { useCuration } from "../curation/use-curation";
import { createSingleEffectRecipe } from "../lab/lab-core";
import {
  MOTION_CHAPTERS,
  MOTION_PAGE_SIZE,
  MOTION_STUDIES,
} from "../motion-catalog";
import { AtomicAtlas } from "../render/atomic-atlas";
import { getActiveStudies, getLibraryPage } from "./library-core";

const sharedCard = {
  title: "SPECTRA",
  subtitle: "COLOR AS A LIVING SYSTEM.",
  radius: 10,
  width: DEFAULT_CARD_WIDTH,
  height: DEFAULT_CARD_HEIGHT,
};

const makeCards = (seed: number): CardConfig[] =>
  createGallery(seed).map((visual) => ({
    ...sharedCard,
    ...visual,
    label: `${String(visual.studyId + 1).padStart(2, "0")} · ${MOTION_STUDIES[visual.studyId].name}`,
  }));

export default function LibraryPage() {
  const admin = useAdmin();
  const { state, hydrated, saving, warning, add, deleteStudy } = useCuration();
  const [masterSeed, setMasterSeed] = useState(20260807);
  const [playing, setPlaying] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [notice, setNotice] = useState("一百四十四种单效果已载入");
  const activeStudies = getActiveStudies(state.deletedStudyIds);
  const pageCount = Math.ceil(activeStudies.length / MOTION_PAGE_SIZE);
  const safePageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
  const visibleStudies = getLibraryPage(activeStudies, safePageIndex);
  const cards = useMemo(() => makeCards(masterSeed), [masterSeed]);
  const visibleIds = new Set(visibleStudies.map(({ id }) => id));
  const visibleCards = cards.filter(({ studyId }) => visibleIds.has(studyId));

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => {
      setPlaying(false);
      setNotice("已按系统设置暂停动画");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const randomizeAll = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    setMasterSeed(values[0]);
    setNotice(`全部视觉已随机 · ${values[0]}`);
  };

  const addToHome = async (config: CardConfig) => {
    const added = await add("library", createSingleEffectRecipe(config));
    setNotice(added ? `${config.label} 已展示到首页` : `${config.label} 已在首页`);
  };

  const removeStudy = async (config: CardConfig) => {
    await deleteStudy(config.studyId);
    const remainingPages = Math.ceil(
      Math.max(0, activeStudies.length - 1) / MOTION_PAGE_SIZE,
    );
    setPageIndex((current) => Math.min(current, Math.max(0, remainingPages - 1)));
    setNotice(`${config.label} 已删除`);
  };

  return (
    <main className="studio library-studio" id="top">
      <div className="studio-shell">
        <aside className="control-rail">
          <div className="control-rail-inner">
            <header className="studio-header">
              <a className="brand" href="/" aria-label="返回 SPECTRA FLUX 首页">
                SPECTRA FLUX
              </a>
              <a className="section-link" href="/">
                策展首页
              </a>
              <a className="section-link" href="/lab">
                随机实验室
              </a>
            </header>

            <section className="intro">
              <span className="eyebrow">ATOMIC MOTION LIBRARY / 2026</span>
              <h1>一百四十四种单效果</h1>
              <p>
                每页探索十二种原子动态。随机当前视觉后，可把喜欢的精确版本展示到首页；删除会同时移出随机实验室。
              </p>
            </section>

            <div className="toolbar" aria-label="效果库操作">
              <button className="button button-primary" onClick={randomizeAll}>
                <span aria-hidden="true">✦</span> 一键全部随机
              </button>
              <button className="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? "暂停" : "播放"}
              </button>
              <button
                className="button button-quiet"
                onClick={() => {
                  setMasterSeed(20260807);
                  setPageIndex(0);
                  setNotice("已恢复默认视觉");
                }}
              >
                重置
              </button>
              <span className="toolbar-status" aria-live="polite">
                {warning ?? notice}
              </span>
            </div>

            {pageCount > 0 ? (
              <nav className="page-tabs" aria-label="效果分页">
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    key={index}
                    className="page-tab"
                    aria-current={safePageIndex === index ? "page" : undefined}
                    onClick={() => setPageIndex(index)}
                  >
                    <span>{`${String(index * 12 + 1).padStart(2, "0")}–${String(Math.min((index + 1) * 12, activeStudies.length)).padStart(2, "0")}`}</span>
                    <small>{MOTION_CHAPTERS[index]?.title ?? `第 ${index + 1} 页`}</small>
                  </button>
                ))}
              </nav>
            ) : null}

            <footer>
              <span>ONE WEBGL CONTEXT · 144 ATOMIC STUDIES</span>
              <span>400 × 100 · COLOR AREA 75%</span>
            </footer>
          </div>
        </aside>

        <section className="gallery-panel workspace" aria-label="一百四十四种单效果">
          {visibleCards.length > 0 ? (
            <AtomicAtlas
              key={safePageIndex}
              configs={visibleCards}
              playing={playing}
              actions={admin.authenticated ? (config) => (
                <>
                  <button disabled={!hydrated || saving} onClick={() => void addToHome(config)}>
                    展示到首页
                  </button>
                  <button
                    className="danger-action"
                    disabled={!hydrated || saving}
                    onClick={() => void removeStudy(config)}
                  >
                    删除
                  </button>
                </>
              ) : undefined}
            />
          ) : (
            <div className="empty-showcase">
              <h2>效果库已清空</h2>
              <p>随机实验室已无可用动态，已保存到首页的作品不会受影响。</p>
              <a className="button" href="/">
                返回策展首页
              </a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
