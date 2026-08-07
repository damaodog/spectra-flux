"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
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

const variantNames = [
  "柔雾扩散",
  "彩墨叠层",
  "横向薄纱",
  "墨滴晕染",
  "斜向漂移",
  "深景云雾",
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

type PreviewProps = {
  config: CardConfig;
  playing: boolean;
};

function WebGLPreview({ config, playing }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef(config);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    paramsRef.current = config;
  }, [config]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: false,
      antialias: false,
    });

    if (!canvas || !gl) {
      setError("此设备不支持 WebGL2，已显示静态渐变");
      return;
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("无法创建着色器");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || "着色器编译失败");
      }
      return shader;
    };

    try {
      const program = gl.createProgram();
      if (!program) throw new Error("无法创建 WebGL 程序");
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "着色器链接失败");
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
        time: gl.getUniformLocation(program, "time"),
        seed: gl.getUniformLocation(program, "seed"),
        intensity: gl.getUniformLocation(program, "intensity"),
        variant: gl.getUniformLocation(program, "variant"),
        colorA: gl.getUniformLocation(program, "colorA"),
        colorB: gl.getUniformLocation(program, "colorB"),
      };

      const resize = () => {
        const box = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(box.width * ratio));
        canvas.height = Math.max(1, Math.round(box.height * ratio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        drawRef.current?.(0);
      };

      drawRef.current = (now) => {
        const current = paramsRef.current;
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform1f(
          uniforms.time,
          now * 0.001 * current.speed * SMOKE_TIME_SCALE,
        );
        gl.uniform1f(uniforms.seed, toShaderSeed(current.seed));
        gl.uniform1f(uniforms.intensity, current.intensity);
        gl.uniform1i(uniforms.variant, current.variant);
        gl.uniform3fv(uniforms.colorA, hexToRgb(current.colorA));
        gl.uniform3fv(uniforms.colorB, hexToRgb(current.colorB));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();
      setError("");

      const contextLost = (event: Event) => {
        event.preventDefault();
        setError("WebGL 暂时中断，请刷新页面恢复");
      };
      canvas.addEventListener("webglcontextlost", contextLost);

      return () => {
        observer.disconnect();
        canvas.removeEventListener("webglcontextlost", contextLost);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        gl.deleteBuffer(buffer);
        drawRef.current = null;
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "WebGL 初始化失败");
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      if (!document.hidden) drawRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    if (playing) frame = requestAnimationFrame(draw);
    else drawRef.current?.(0);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span className="render-label">{error ? "CSS FALLBACK" : "WEBGL 2 / GLSL"}</span>
      {error && <span className="webgl-error">{error}</span>}
    </>
  );
}

export default function Home() {
  const [cards, setCards] = useState(() => makeCards(20260807));
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [notice, setNotice] = useState("当前显示 01 · 柔雾扩散");
  const activeCard = cards[activeIndex];

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
    setNotice(`六款已全部随机 · ${masterSeed}`);
  };

  const cardStyle = {
    "--card-a": activeCard.colorA,
    "--card-b": activeCard.colorB,
    "--card-radius": `${activeCard.radius}px`,
    "--card-width": `${activeCard.width}px`,
    "--card-height": `${activeCard.height}px`,
  } as CSSProperties;

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
          <span className="eyebrow">SIX GENERATIVE SMOKE STUDIES / 2026</span>
          <h1>一张卡片，<br />六种彩雾。</h1>
        </div>
        <p>
          页面始终只渲染一个 WebGL 画布。用编号切换六种烟雾结构，
          点击一次即可让六款获得各自不同的配色、种子与动态。
        </p>
      </section>

      <section className="workspace" aria-label="单张动态彩雾卡片">
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
              setActiveIndex(0);
              setNotice("已恢复默认 · 01 柔雾扩散");
            }}
          >
            重置
          </button>
          <span className="toolbar-status" aria-live="polite">{notice}</span>
        </div>

        <div className="single-preview">
          <div className="style-heading" aria-live="polite">
            <b>{String(activeIndex + 1).padStart(2, "0")}</b>
            <span>{variantNames[activeIndex]}</span>
          </div>

          <article className="preview-card" style={cardStyle}>
            <div className="card-copy">
              <span className="card-label">{activeCard.label}</span>
              <h2>{activeCard.title}</h2>
              <p>{activeCard.subtitle}</p>
              <div className="card-index">
                <span>SEED</span>
                <b>{String(activeCard.seed).padStart(10, "0").slice(-10)}</b>
              </div>
            </div>
            <div className="card-visual">
              <WebGLPreview
                key={activeCard.variant}
                config={activeCard}
                playing={playing}
              />
            </div>
          </article>

          <nav className="style-tabs" aria-label="选择烟雾样式">
            {variantNames.map((name, index) => (
              <button
                className={`style-tab${activeIndex === index ? " is-active" : ""}`}
                aria-label={`查看 ${String(index + 1).padStart(2, "0")} ${name}`}
                aria-pressed={activeIndex === index}
                onClick={() => {
                  setActiveIndex(index);
                  setNotice(`当前显示 ${String(index + 1).padStart(2, "0")} · ${name}`);
                }}
                key={name}
              >
                {String(index + 1).padStart(2, "0")}
              </button>
            ))}
          </nav>
        </div>
      </section>

      <footer>
        <span>ONE CANVAS · SIX SMOKE STUDIES</span>
        <span>400 × 100 · COLOR AREA 65%</span>
      </footer>
    </main>
  );
}
