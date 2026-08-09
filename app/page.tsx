"use client";

import Link from "next/link";
import { useState } from "react";
import { RecipeAtlas } from "./render/recipe-atlas";

export default function Home() {
  const [playing, setPlaying] = useState(true);

  return (
    <main className="studio" id="top">
      <div className="studio-shell">
        <aside className="control-rail">
          <div className="control-rail-inner">
            <header className="studio-header">
              <a className="brand" href="#top" aria-label="SPECTRA FLUX 首页">
                SPECTRA FLUX
              </a>
              <Link className="section-link" href="/library">
                效果库
              </Link>
              <Link className="section-link" href="/lab">
                随机实验室
              </Link>
            </header>
            <section className="intro">
              <span className="eyebrow">CURATED GENERATIVE MOTION / 2026</span>
              <h1>策展首页</h1>
              <p>这里只展示从效果库或随机实验室明确加入的动态作品。</p>
            </section>
            <div className="toolbar">
              <button className="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? "暂停" : "播放"}
              </button>
            </div>
          </div>
        </aside>
        <section className="gallery-panel workspace" aria-label="策展动态作品">
          <div className="empty-showcase">
            <p>尚未添加动态作品</p>
          </div>
          <RecipeAtlas entries={[]} playing={playing} />
        </section>
      </div>
    </main>
  );
}
