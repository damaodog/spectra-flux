"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  createGallery,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  FRAGMENT_SHADER,
  hexToRgb,
  SMOKE_VARIANT_COUNT,
  SMOKE_TIME_SCALE,
  toShaderSeed,
  VERTEX_SHADER,
  type CardConfig,
} from "./card-core";

const variantNames = [
  "柔雾扩散",
  "彩墨叠层",
  "横向薄纱",
  "墨滴晕染",
  "斜向漂移",
  "深景云雾",
  "双流撞击",
  "墨云扩散",
  "色域融合",
  "潮汐呼吸",
  "急速奔流",
  "慢雾沉降",
] as const;

const sharedInitial = {
  title: "SPECTRA",
  subtitle: "COLOR AS A LIVING SYSTEM.",
  radius: 54,
  width: DEFAULT_CARD_WIDTH,
  height: DEFAULT_CARD_HEIGHT,
};

const makeCards = (seed: number): CardConfig[] =>
  createGallery(seed).map((visual, variant) => ({
    ...sharedInitial,
    ...visual,
    label: `STYLE ${String(variant + 1).padStart(2, "0")} · ${variantNames[variant]}`,
  }));

type GalleryProps = {
  configs: CardConfig[];
  playing: boolean;
};

const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = Math.ceil(SMOKE_VARIANT_COUNT / ATLAS_COLUMNS);

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
        colorA: gl.getUniformLocation(program, "colorA"),
        colorB: gl.getUniformLocation(program, "colorB"),
      };

      let tileWidth = 1;
      let tileHeight = 1;

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
        tileWidth = Math.max(1, Math.round(box.width * ratio));
        tileHeight = Math.max(1, Math.round(box.height * ratio));
        source.width = tileWidth * ATLAS_COLUMNS;
        source.height = tileHeight * ATLAS_ROWS;
        targets.forEach((target) => {
          target.width = tileWidth;
          target.height = tileHeight;
        });
        drawRef.current?.(lastTimeRef.current);
      };

      const observer = new ResizeObserver(resize);
      targets.forEach((target) => observer.observe(target));
      resize();

      return () => {
        observer.disconnect();
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
        const studyNumber = String(index + 1).padStart(2, "0");

        return (
          <div className="card-study" key={config.variant}>
            <span className="study-meta">
              {`${studyNumber} · ${variantNames[index]}`}
            </span>
            <article
              className="preview-card"
              style={cardStyle}
              aria-label={`SPECTRA ${studyNumber} ${variantNames[index]}`}
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
  const [notice, setNotice] = useState("十二款墨流同时展示");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setNotice("已按系统设置暂停动画");
    }
  }, []);

  const randomizeAll = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const masterSeed = values[0];
    const visuals = createGallery(masterSeed);
    setCards((current) =>
      current.map((card, index) => ({ ...card, ...visuals[index] })),
    );
    setNotice(`十二款已全部随机 · ${masterSeed}`);
  };

  return (
    <main className="studio">
      <header className="studio-header">
        <a className="brand" href="#top" aria-label="Luma Lab 首页">LUMA LAB</a>
        <div className="header-meta">
          <span>WEBGL SMOKE STUDIES</span>
          <span className="live-dot" aria-hidden="true" />
          <span>{playing ? "LIVE" : "PAUSED"}</span>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <span className="eyebrow">TWELVE GENERATIVE SMOKE STUDIES / 2026</span>
          <h1>十二张卡片，<br />十二种墨流。</h1>
        </div>
        <p>
          十二张卡片由一个 WebGL 图集同步驱动。每次随机都会更新十二套配色、种子与流动结构，
          同时保持页面轻量流畅。
        </p>
      </section>

      <section className="workspace" aria-label="十二张动态墨流卡片">
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
              setNotice("已恢复十二款默认墨流");
            }}
          >
            重置
          </button>
          <span className="toolbar-status" aria-live="polite">{notice}</span>
        </div>

        <AtlasGallery configs={cards} playing={playing} />
      </section>

      <footer>
        <span>ONE WEBGL CONTEXT · TWELVE INK STUDIES</span>
        <span>400 × 100 · COLOR AREA 75%</span>
      </footer>
    </main>
  );
}
