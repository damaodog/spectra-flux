"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPanel } from "./admin/admin-panel";
import { useAdmin } from "./admin/use-admin";
import { useCuration } from "./curation/use-curation";
import { MOTION_PAGE_SIZE } from "./motion-catalog";
import { RecipeAtlas } from "./render/recipe-atlas";

export default function Home() {
  const admin = useAdmin();
  const {
    state,
    hydrated,
    saving,
    warning,
    legacyState,
    remove,
    migrateLegacy,
    exportJson,
  } = useCuration();
  const [playing, setPlaying] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [adminOpen, setAdminOpen] = useState(false);
  const [notice, setNotice] = useState("共享策展首页已载入");
  const pageCount = Math.ceil(state.showcase.length / MOTION_PAGE_SIZE);
  const safePageIndex = Math.min(pageIndex, Math.max(0, pageCount - 1));
  const pageStart = safePageIndex * MOTION_PAGE_SIZE;
  const visibleEntries = state.showcase.slice(pageStart, pageStart + MOTION_PAGE_SIZE);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => {
      setPlaying(false);
      setNotice("已按系统设置暂停动画");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const removeFromHome = async (entryId: string) => {
    await remove(entryId);
    const remainingPages = Math.ceil(
      Math.max(0, state.showcase.length - 1) / MOTION_PAGE_SIZE,
    );
    setPageIndex((current) => Math.min(current, Math.max(0, remainingPages - 1)));
    setNotice("已从共享首页删除");
  };

  const downloadCuration = () => {
    try {
      const blob = new Blob([exportJson()], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "spectra-curation.json";
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("策展配置已导出");
    } catch {
      setNotice("导出失败，策展内容未改变");
    }
  };

  return (
    <main className="studio" id="top">
      <div className="studio-shell">
        <aside className="control-rail">
          <div className="control-rail-inner">
            <header className="studio-header">
              <a className="brand" href="#top" aria-label="SPECTRA FLUX 首页">SPECTRA FLUX</a>
              <Link className="section-link" href="/library">效果库</Link>
              <Link className="section-link" href="/lab">随机实验室</Link>
            </header>

            <section className="intro">
              <span className="eyebrow">CURATED GENERATIVE MOTION / 2026</span>
              <h1>策展首页</h1>
              <p>这里只展示从效果库或随机实验室精选加入的动态作品。所有访客看到同一份策展，新作品始终排在最前。</p>
            </section>

            <div className="toolbar" aria-label="策展首页操作">
              <button className="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? "暂停" : "播放"}
              </button>
              <button className="button" onClick={() => setAdminOpen(true)}>
                {admin.authenticated ? "管理中" : "管理"}
              </button>
              {admin.authenticated ? (
                <button className="button button-quiet" disabled={!hydrated || saving} onClick={downloadCuration}>
                  导出策展配置
                </button>
              ) : null}
              <span className="toolbar-status" aria-live="polite">{warning ?? notice}</span>
            </div>

            {pageCount > 1 ? (
              <nav className="page-tabs pagination" aria-label="首页作品分页">
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    className="page-tab"
                    key={index}
                    aria-current={safePageIndex === index ? "page" : undefined}
                    onClick={() => setPageIndex(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>第 {index + 1} 页</small>
                  </button>
                ))}
              </nav>
            ) : null}

            <footer>
              <span>SHARED CURATION · 12 WORKS PER PAGE</span>
              <span>400 × 100 · COLOR AREA 75%</span>
            </footer>
          </div>
        </aside>

        <section className="gallery-panel workspace" aria-label="策展动态作品">
          {visibleEntries.length > 0 ? (
            <RecipeAtlas
              entries={visibleEntries}
              playing={playing}
              onRemove={admin.authenticated ? removeFromHome : undefined}
            />
          ) : (
            <div className="empty-showcase">
              <span className="eyebrow">YOUR COLLECTION STARTS HERE</span>
              <h2>尚未添加动态作品</h2>
              <p>先浏览单效果，或让多个动态在同一张卡片里融合。</p>
              <div className="empty-actions">
                <Link className="button button-primary" href="/library">进入效果库</Link>
                <Link className="button" href="/lab">开始随机创作</Link>
              </div>
            </div>
          )}
        </section>
      </div>

      <AdminPanel
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        admin={admin}
        legacyState={legacyState}
        onMigrate={migrateLegacy}
        migrating={saving}
        showcaseCount={state.showcase.length}
      />
    </main>
  );
}
