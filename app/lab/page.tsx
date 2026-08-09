"use client";
/* eslint-disable @next/next/no-html-link-for-pages -- vinext production RSC navigation is broken; native anchors are intentional. */

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { useAdmin } from "../admin/use-admin";
import { useCuration } from "../curation/use-curation";
import { CopyEmbedButton } from "../embed/copy-embed-button";
import { getActiveStudies } from "../library/library-core";
import {
  DEFAULT_LAB_SETTINGS,
  INTERACTION_LABELS,
  createLabRecipe,
  formatLabRecipe,
  type CompositionDirection,
  type DensityDirection,
  type EdgeDirection,
  type InteractionBias,
  type LabSettings,
  type MixIntensity,
  type PaletteDirection,
  type RhythmDirection,
} from "./lab-core";
import { LabPreview } from "./lab-preview";

const effectCounts = [1, 2, 3, 4, 5, 6] as const;
const intensityOptions: { value: MixIntensity; label: string }[] = [
  { value: "soft", label: "柔和" },
  { value: "balanced", label: "均衡" },
  { value: "intense", label: "激烈" },
];
const paletteOptions: { value: PaletteDirection; label: string }[] = [
  { value: "random", label: "随机" },
  { value: "analogous", label: "邻近雾化" },
  { value: "warm-cool", label: "冷暖碰撞" },
  { value: "triadic", label: "三角色交缠" },
  { value: "dominant-highlight", label: "主色高光" },
  { value: "low-saturation-ink", label: "低饱和墨流" },
];
const interactionOptions: { value: InteractionBias; label: string }[] = [
  { value: "random", label: "完全随机" },
  { value: "free", label: "自由混合" },
  { value: "blend", label: "融合优先" },
  { value: "collision", label: "撞击优先" },
  { value: "weave", label: "交缠优先" },
  { value: "erode", label: "吞噬优先" },
  { value: "light", label: "光叠优先" },
  { value: "difference", label: "差异切割" },
];
const rhythmOptions: { value: RhythmDirection; label: string }[] = [
  { value: "random", label: "完全随机" },
  { value: "wander", label: "缓慢漫游" },
  { value: "breath", label: "呼吸起伏" },
  { value: "alternating", label: "忽快忽慢" },
  { value: "pulse", label: "脉冲撞击" },
  { value: "flow", label: "持续涌流" },
];
const compositionOptions: { value: CompositionDirection; label: string }[] = [
  { value: "random", label: "完全随机" },
  { value: "automatic", label: "自动构图" },
  { value: "horizontal", label: "横向流动" },
  { value: "center-collision", label: "中心碰撞" },
  { value: "pincer", label: "两侧夹击" },
  { value: "vortex", label: "旋涡汇聚" },
  { value: "interlace", label: "交错穿插" },
];
const densityOptions: { value: DensityDirection; label: string }[] = [
  { value: "random", label: "完全随机" },
  { value: "thin", label: "轻薄留白" },
  { value: "standard", label: "标准密度" },
  { value: "dense", label: "浓密饱满" },
];
const edgeOptions: { value: EdgeDirection; label: string }[] = [
  { value: "random", label: "完全随机" },
  { value: "soft", label: "柔雾边缘" },
  { value: "mixed", label: "软硬混合" },
  { value: "sharp", label: "锋利纹路" },
];
const initialSettings: LabSettings = {
  ...DEFAULT_LAB_SETTINGS,
  interactionBias: "random",
  rhythm: "random",
  composition: "random",
  density: "random",
  edge: "random",
};
const initialRecipe = createLabRecipe(initialSettings, 20260808)!;

function ConstraintSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange(value: T): void;
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export default function LabPage() {
  const admin = useAdmin();
  const { state, hydrated, saving, warning, add } = useCuration();
  const [settings, setSettings] = useState<LabSettings>(initialSettings);
  const [recipe, setRecipe] = useState(initialRecipe);
  const [playing, setPlaying] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [notice, setNotice] = useState("调整约束后，一键生成新的混合配方");
  const activeStudies = getActiveStudies(state.deletedStudyIds);

  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frame = requestAnimationFrame(() => {
      setPlaying(false);
      setNotice("已按系统设置暂停动画");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const updateSettings = (patch: Partial<LabSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  };

  const randomize = () => {
    if (activeStudies.length === 0) {
      setNotice("效果库已无可用动态，请先恢复效果库");
      return;
    }
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const next = createLabRecipe(settings, values[0], activeStudies);
    if (!next) return;
    setRecipe(next);
    setNotice(`${next.effectCount} 种效果已重新混合`);
  };

  const addToShowcase = async () => {
    const added = await add("lab", recipe);
    setNotice(added ? "已展示到首页" : "这张配方已在首页");
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
              <a className="brand" href="/" aria-label="返回 SPECTRA FLUX 首页">
                SPECTRA FLUX
              </a>
              <a className="section-link" href="/">
                策展首页
              </a>
              <a className="section-link" href="/library">
                效果库
              </a>
            </header>

            <section className="intro lab-intro">
              <span className="eyebrow">SINGLE-CARD RANDOM MIX LAB / 2026</span>
              <h1>一张卡片，<br />多重动态。</h1>
              <p>
                设定效果数量、混合强度、速度边界和配色方向。每次随机都会重新组合动态、交互与忽快忽慢的节奏。
              </p>
            </section>

            <div className="lab-settings">
              <fieldset className="effect-count">
                <legend>选择效果数量</legend>
                <div>
                  {effectCounts.map((count) => (
                    <button
                      type="button"
                      aria-pressed={settings.effectCount === count}
                      onClick={() => updateSettings({ effectCount: count })}
                      key={count}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mix-intensity">
                <legend>混合强度</legend>
                <div>
                  {intensityOptions.map((option) => (
                    <button
                      type="button"
                      aria-pressed={settings.mixIntensity === option.value}
                      onClick={() => updateSettings({ mixIntensity: option.value })}
                      key={option.value}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="speed-bounds">
                <label>
                  <span>速度下限</span>
                  <output>{settings.speedMin.toFixed(1)}×</output>
                  <input
                    type="range"
                    min="0.1"
                    max="2.5"
                    step="0.1"
                    value={settings.speedMin}
                    onChange={(event) =>
                      updateSettings({
                        speedMin: Math.min(
                          Number(event.target.value),
                          settings.speedMax - 0.1,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <span>速度上限</span>
                  <output>{settings.speedMax.toFixed(1)}×</output>
                  <input
                    type="range"
                    min="0.2"
                    max="2.6"
                    step="0.1"
                    value={settings.speedMax}
                    onChange={(event) =>
                      updateSettings({
                        speedMax: Math.max(
                          Number(event.target.value),
                          settings.speedMin + 0.1,
                        ),
                      })
                    }
                  />
                </label>
              </div>

              <label className="palette-direction">
                <span>配色方向</span>
                <select
                  value={settings.paletteDirection}
                  onChange={(event) =>
                    updateSettings({
                      paletteDirection: event.target.value as PaletteDirection,
                    })
                  }
                >
                  {paletteOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <details className="advanced-settings">
                <summary>更多随机约束</summary>
                <div>
                  <ConstraintSelect
                    label="互动方式"
                    value={settings.interactionBias ?? "random"}
                    options={interactionOptions}
                    onChange={(interactionBias) => updateSettings({ interactionBias })}
                  />
                  <ConstraintSelect
                    label="节奏方式"
                    value={settings.rhythm ?? "random"}
                    options={rhythmOptions}
                    onChange={(rhythm) => updateSettings({ rhythm })}
                  />
                  <ConstraintSelect
                    label="构图方式"
                    value={settings.composition ?? "random"}
                    options={compositionOptions}
                    onChange={(composition) => updateSettings({ composition })}
                  />
                  <ConstraintSelect
                    label="视觉密度"
                    value={settings.density ?? "random"}
                    options={densityOptions}
                    onChange={(density) => updateSettings({ density })}
                  />
                  <ConstraintSelect
                    label="边缘质感"
                    value={settings.edge ?? "random"}
                    options={edgeOptions}
                    onChange={(edge) => updateSettings({ edge })}
                  />
                </div>
              </details>
            </div>

            <div className="toolbar lab-toolbar" aria-label="随机实验室操作">
              <button
                className="button button-primary"
                onClick={randomize}
                disabled={!hydrated || activeStudies.length === 0}
              >
                <span aria-hidden="true">✦</span> 一键随机创作
              </button>
              <button className="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? "暂停" : "继续"}
              </button>
              <CopyEmbedButton recipe={recipe} />
              {admin.authenticated ? (
                <button className="button" onClick={() => void addToShowcase()} disabled={!hydrated || saving}>
                  展示到首页
                </button>
              ) : null}
              <span className="toolbar-status" aria-live="polite">
                {warning ?? (fallback ? "静态预览" : notice)}
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
              <div className="recipe-swatches" aria-label={`${recipe.paletteName}配色`}>
                {recipe.palette.map((color, index) => (
                  <span key={`${color}-${index}`} style={{ backgroundColor: color }} />
                ))}
              </div>
              <dl className="recipe-summary">
                <div><dt>混合</dt><dd>{intensityOptions.find(({ value }) => value === recipe.mixIntensity)?.label}</dd></div>
                <div><dt>配色</dt><dd>{recipe.paletteName}</dd></div>
                <div><dt>互动</dt><dd>{interactionOptions.find(({ value }) => value === recipe.interactionBias)?.label}</dd></div>
                <div><dt>节奏</dt><dd>{rhythmOptions.find(({ value }) => value === recipe.rhythm)?.label}</dd></div>
                <div><dt>构图</dt><dd>{compositionOptions.find(({ value }) => value === recipe.composition)?.label}</dd></div>
                <div><dt>密度</dt><dd>{densityOptions.find(({ value }) => value === recipe.density)?.label}</dd></div>
                <div><dt>边缘</dt><dd>{edgeOptions.find(({ value }) => value === recipe.edge)?.label}</dd></div>
              </dl>
              <ol>
                {recipe.layers.map((layer, index) => (
                  <li key={layer.studyId}>
                    <span>
                      {String(layer.studyId + 1).padStart(3, "0")} · {layer.name}
                      {index > 0
                        ? ` · ${INTERACTION_LABELS[recipe.interactions[index - 1]]}`
                        : ""}
                    </span>
                    <small>{layer.speed.min.toFixed(2)}–{layer.speed.max.toFixed(2)}×</small>
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
