"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createGallery,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  FRAGMENT_SHADER,
  hexToRgb,
  SMOKE_TIME_SCALE,
  toShaderSeed,
  VERTEX_SHADER,
  type CardConfig,
} from "./card-core";
import { MOTION_PAGE_SIZE, MOTION_STUDIES } from "./motion-catalog";

const pages = [
  { range: "01–12", title: "雾与薄纱" },
  { range: "13–24", title: "光学材质" },
  { range: "25–36", title: "流体力场" },
  { range: "37–48", title: "晶体生长" },
  { range: "49–60", title: "电磁脉冲" },
  { range: "61–72", title: "天体引力" },
] as const;

const sharedInitial = {
  title: "SPECTRA",
  subtitle: "COLOR AS A LIVING SYSTEM.",
  radius: 54,
  width: DEFAULT_CARD_WIDTH,
  height: DEFAULT_CARD_HEIGHT,
};

const makeCards = (seed: number): CardConfig[] =>
  createGallery(seed).map((visual) => ({
    ...sharedInitial,
    ...visual,
    label: `STYLE ${String(visual.studyId + 1).padStart(2, "0")} · ${MOTION_STUDIES[visual.studyId].name}`,
  }));

type GalleryProps = {
  configs: CardConfig[];
  playing: boolean;
};

const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = Math.ceil(MOTION_PAGE_SIZE / ATLAS_COLUMNS);

function AtlasGallery({ configs, playing }: GalleryProps) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const paramsRef = useRef(configs);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    paramsRef.current = configs;
    drawRef.current?.(lastTimeRef.current);
  }, [configs]);

  useEffect(() => {
    const targets = canvasRefs.current.filter(
      (canvas): canvas is HTMLCanvasElement => Boolean(canvas),
    );
    if (targets.length !== configs.length) return;

    const source = document.createElement("canvas");
    const gl = source.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    const contexts = targets.map((canvas) => canvas.getContext("2d"));
    if (!gl || contexts.some((context) => !context)) return;

    const compile = (type: number, shaderSource: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create shader");
      gl.shaderSource(shader, shaderSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
      }
      return shader;
    };

    try {
      const program = gl.createProgram();
      if (!program) return;
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Shader link failed");
      }
      gl.useProgram(program);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms = {
        resolution: gl.getUniformLocation(program, "resolution"),
        viewportOrigin: gl.getUniformLocation(program, "viewportOrigin"),
        time: gl.getUniformLocation(program, "time"),
        seed: gl.getUniformLocation(program, "seed"),
        intensity: gl.getUniformLocation(program, "intensity"),
        variant: gl.getUniformLocation(program, "variant"),
        kernel: gl.getUniformLocation(program, "kernel"),
        studyParams: gl.getUniformLocation(program, "studyParams"),
        colorA: gl.getUniformLocation(program, "colorA"),
        colorB: gl.getUniformLocation(program, "colorB"),
      };

      let tileWidth = 1;
      let tileHeight = 1;
      let resizeFrame = 0;

      drawRef.current = (now) => {
        lastTimeRef.current = now;
        gl.enable(gl.SCISSOR_TEST);
        paramsRef.current.forEach((config, index) => {
          const column = index % ATLAS_COLUMNS;
          const row = Math.floor(index / ATLAS_COLUMNS);
          const atlasX = column * tileWidth;
          const atlasY = (ATLAS_ROWS - row - 1) * tileHeight;
          gl.viewport(atlasX, atlasY, tileWidth, tileHeight);
          gl.scissor(atlasX, atlasY, tileWidth, tileHeight);
          gl.uniform2f(uniforms.resolution, tileWidth, tileHeight);
          gl.uniform2f(uniforms.viewportOrigin, atlasX, atlasY);
          gl.uniform1f(
            uniforms.time,
            now * 0.001 * config.speed * SMOKE_TIME_SCALE,
          );
          gl.uniform1f(uniforms.seed, toShaderSeed(config.seed));
          gl.uniform1f(uniforms.intensity, config.intensity);
          gl.uniform1i(uniforms.variant, config.variant);
          gl.uniform1i(uniforms.kernel, config.kernel);
          gl.uniform4fv(uniforms.studyParams, config.params);
          gl.uniform3fv(uniforms.colorA, hexToRgb(config.colorA));
          gl.uniform3fv(uniforms.colorB, hexToRgb(config.colorB));
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        });

        contexts.forEach((context, index) => {
          const target = targets[index];
          const sourceX = (index % ATLAS_COLUMNS) * tileWidth;
          const sourceY = Math.floor(index / ATLAS_COLUMNS) * tileHeight;
          context?.clearRect(0, 0, target.width, target.height);
          context?.drawImage(
            source,
            sourceX,
            sourceY,
            tileWidth,
            tileHeight,
            0,
            0,
            target.width,
            target.height,
          );
        });
      };

      const resize = () => {
        const box = targets[0].getBoundingClientRect();
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          configs.length > 6 ? 1.5 : 2,
        );
        const nextTileWidth = Math.max(1, Math.round(box.width * ratio));
        const nextTileHeight = Math.max(1, Math.round(box.height * ratio));
        if (tileWidth === nextTileWidth && tileHeight === nextTileHeight) return;
        tileWidth = nextTileWidth;
        tileHeight = nextTileHeight;
        const nextSourceWidth = tileWidth * ATLAS_COLUMNS;
        const nextSourceHeight = tileHeight * ATLAS_ROWS;
        if (source.width !== nextSourceWidth) source.width = nextSourceWidth;
        if (source.height !== nextSourceHeight) source.height = nextSourceHeight;
        targets.forEach((target) => {
          if (target.width !== tileWidth) target.width = tileWidth;
          if (target.height !== tileHeight) target.height = tileHeight;
        });
        drawRef.current?.(lastTimeRef.current);
      };

      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(resize);
      });
      observer.observe(targets[0]);
      resize();

      return () => {
        observer.disconnect();
        cancelAnimationFrame(resizeFrame);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        gl.deleteBuffer(buffer);
        drawRef.current = null;
      };
    } catch (error) {
      console.warn("Luma atlas WebGL fallback", error);
    }
  }, [configs.length]);

  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      if (!document.hidden) drawRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    if (playing) frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return (
    <div className="atlas-gallery">
      {configs.map((config, index) => {
        const cardStyle = {
          "--card-a": config.colorA,
          "--card-b": config.colorB,
          "--card-radius": `${config.radius}px`,
          "--card-width": `${config.width}px`,
          "--card-height": `${config.height}px`,
        } as CSSProperties;
        const studyNumber = String(config.studyId + 1).padStart(2, "0");
        const studyName = MOTION_STUDIES[config.studyId].name;

        return (
          <div className="card-study" key={config.studyId}>
            <span className="study-meta">
              {`${studyNumber} · ${studyName}`}
            </span>
            <article
              className="preview-card"
              style={cardStyle}
              aria-label={`SPECTRA ${studyNumber} ${studyName}`}
            >
              <div className="card-copy">
                <h2>{config.title}</h2>
                <p>{config.subtitle}</p>
              </div>
              <div className="card-visual">
                <canvas
                  ref={(canvas) => {
                    canvasRefs.current[index] = canvas;
                  }}
                  aria-hidden="true"
                />
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [cards, setCards] = useState(() => makeCards(20260807));
  const [playing, setPlaying] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [notice, setNotice] = useState("七十二款动态已载入");
  const pageStart = pageIndex * MOTION_PAGE_SIZE;
  const visibleCards = cards.slice(pageStart, pageStart + MOTION_PAGE_SIZE);

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
    const masterSeed = values[0];
    const visuals = createGallery(masterSeed);
    setCards((current) =>
      current.map((card, index) => ({ ...card, ...visuals[index] })),
    );
    setNotice(`七十二款已全部随机 · ${masterSeed}`);
  };

  return (
    <main className="studio" id="top">
      <div className="studio-shell">
        <aside className="control-rail">
          <div className="control-rail-inner">
            <header className="studio-header">
              <a className="brand" href="#top" aria-label="SPECTRA FLUX 首页">
                SPECTRA FLUX
              </a>
              <Link className="section-link" href="/lab">随机实验室</Link>
              <div className="header-meta">
                <span>WEBGL MOTION ATLAS</span>
                <span className="live-dot" aria-hidden="true" />
                <span>{playing ? "LIVE" : "PAUSED"}</span>
              </div>
            </header>

            <section className="intro">
          <span className="eyebrow">SEVENTY-TWO GENERATIVE MOTION STUDIES / 2026</span>
          <h1>七十二张卡片，<br />七十二种动态。</h1>
              <p>
                六页探索雾、光学、流体、晶体、电磁与引力。每页仅驱动十二张卡片，
                一次随机则会更新全部七十二套配色与细节。
              </p>
            </section>

            <div className="toolbar" aria-label="常用操作">
              <button className="button button-primary" onClick={randomizeAll}>
                <span aria-hidden="true">✦</span> 一键全部随机
              </button>
              <button className="button" onClick={() => setPlaying((value) => !value)}>
                {playing ? "暂停" : "播放"}
              </button>
              <button
                className="button button-quiet"
                onClick={() => {
                  setCards(makeCards(20260807));
                  setPageIndex(0);
                  setNotice("已恢复七十二款默认动态");
                }}
              >
                重置
              </button>
              <span className="toolbar-status" aria-live="polite">{notice}</span>
            </div>

            <nav className="page-tabs" aria-label="效果分页">
              {pages.map((page, index) => (
                <button
                  key={page.range}
                  className="page-tab"
                  aria-current={pageIndex === index ? "page" : undefined}
                  onClick={() => setPageIndex(index)}
                >
                  <span>{page.range}</span>
                  <small>{page.title}</small>
                </button>
              ))}
            </nav>

            <footer>
              <span>ONE WEBGL CONTEXT · SEVENTY-TWO MOTION STUDIES</span>
              <span>400 × 100 · COLOR AREA 75%</span>
            </footer>
          </div>
        </aside>

        <section className="gallery-panel workspace" aria-label="七十二张动态效果卡片">
          <AtlasGallery
            key={pageIndex}
            configs={visibleCards}
            playing={playing}
          />
        </section>
      </div>
    </main>
  );
}
