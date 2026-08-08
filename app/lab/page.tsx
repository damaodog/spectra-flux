"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  INTERACTION_LABELS,
  createLabRecipe,
  formatLabRecipe,
} from "./lab-core";
import { LabPreview } from "./lab-preview";

const effectCounts = [2, 3, 4, 5, 6] as const;

export default function LabPage() {
  const [effectCount, setEffectCount] = useState(3);
  const [recipe, setRecipe] = useState(() => createLabRecipe(3, 20260808));
  const [playing, setPlaying] = useState(true);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => setPlaying(false));
    return () => cancelAnimationFrame(frame);
  }, []);

  const randomize = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    setRecipe(createLabRecipe(effectCount, values[0]));
  };

  const cardStyle = {
    "--card-a": recipe.palette[0],
    "--card-b": recipe.palette[1] ?? recipe.palette[0],
    "--card-radius": "54px",
    "--card-width": "400px",
    "--card-height": "100px",
  } as CSSProperties;

  return (
    <main className="studio lab-studio" id="top">
      <div className="studio-shell lab-shell">
        <aside className="control-rail">
          <div className="control-rail-inner">
            <header className="studio-header">
              <Link className="brand" href="/" aria-label="返回 SPECTRA FLUX 动态图谱">
                SPECTRA FLUX
              </Link>
              <Link className="section-link" href="/">
                动态图谱
              </Link>
            </header>

            <section className="intro lab-intro">
              <span className="eyebrow">SINGLE-CARD RANDOM MIX LAB / 2026</span>
              <h1>
                一张卡片，<br />多重动态。
              </h1>
              <p>
                只选择效果数量，其余交给随机：动态、混合、变速与色彩将在同一片流场中相遇。
              </p>
            </section>

            <fieldset className="effect-count">
              <legend>选择效果数量</legend>
              <div>
                {effectCounts.map((count) => (
                  <button
                    type="button"
                    aria-pressed={effectCount === count}
                    onClick={() => setEffectCount(count)}
                    key={count}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="toolbar lab-toolbar" aria-label="随机实验室操作">
              <button className="button button-primary" onClick={randomize}>
                <span aria-hidden="true">✦</span> 一键随机创作
              </button>
              <button
                className="button"
                onClick={() => setPlaying((value) => !value)}
              >
                {playing ? "暂停" : "继续"}
              </button>
              <span className="toolbar-status" aria-live="polite">
                {fallback
                  ? "静态预览"
                  : `${recipe.effectCount} 种效果正在混合 · ${playing ? "LIVE" : "PAUSED"}`}
              </span>
            </div>

            <footer>
              <span>ONE WEBGL CONTEXT · UP TO SIX MOTION LAYERS</span>
              <span>400 × 100 · COLOR AREA 75%</span>
            </footer>
          </div>
        </aside>

        <section className="lab-workspace workspace" aria-label="单卡随机混合预览">
          <div className="lab-card-stage">
            <article
              className="preview-card lab-preview-card"
              style={cardStyle}
              aria-label={`${recipe.effectCount} 种效果随机混合卡片`}
            >
              <div className="card-copy">
                <h2>SPECTRA</h2>
                <p>COLOR AS A LIVING SYSTEM.</p>
              </div>
              <div className="card-visual">
                <LabPreview
                  recipe={recipe}
                  playing={playing}
                  onFallbackChange={setFallback}
                />
              </div>
            </article>

            <div className="lab-recipe" aria-label="本次随机配方">
              <span className="recipe-kicker">本次随机配方</span>
              <p>{formatLabRecipe(recipe)}</p>
              <div
                className="recipe-swatches"
                aria-label={`${recipe.paletteName}配色`}
              >
                {recipe.palette.map((color, index) => (
                  <span
                    key={`${color}-${index}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <ol>
                {recipe.layers.map((layer, index) => (
                  <li key={layer.studyId}>
                    <span>
                      {String(layer.studyId + 1).padStart(2, "0")} · {layer.name}
                      {index > 0
                        ? ` · ${INTERACTION_LABELS[recipe.interactions[index - 1]]}`
                        : ""}
                    </span>
                    <small>
                      {layer.speed.min.toFixed(2)}–{layer.speed.max.toFixed(2)}×
                    </small>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
