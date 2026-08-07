"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import {
  buildEmbed,
  createPreset,
  FRAGMENT_SHADER,
  hexToRgb,
  VERTEX_SHADER,
  type CardConfig,
} from "./card-core";

const initial: CardConfig = {
  title: "SPECTRA",
  subtitle: "COLOR AS A LIVING SYSTEM.",
  label: "GENERATIVE WEBGL / 001",
  colorA: "#ff896f",
  colorB: "#788dff",
  seed: 20260807,
  speed: 0.8,
  intensity: 0.72,
  radius: 64,
  width: 1200,
  height: 420,
  variant: 0,
};

type PreviewProps = {
  config: CardConfig;
  playing: boolean;
  onError: (message: string) => void;
};

function WebGLPreview({ config, playing, onError }: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef(config);
  const drawRef = useRef<((time: number) => void) | null>(null);

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
      onError("此设备不支持 WebGL2，已显示静态渐变");
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
        const colorA = hexToRgb(current.colorA);
        const colorB = hexToRgb(current.colorB);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
        gl.uniform1f(uniforms.time, now * 0.001 * current.speed);
        gl.uniform1f(uniforms.seed, current.seed);
        gl.uniform1f(uniforms.intensity, current.intensity);
        gl.uniform3fv(uniforms.colorA, colorA);
        gl.uniform3fv(uniforms.colorB, colorB);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      resize();
      onError("");

      const contextLost = (event: Event) => {
        event.preventDefault();
        onError("WebGL 暂时中断，请刷新页面恢复");
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
    } catch (error) {
      onError(error instanceof Error ? error.message : "WebGL 初始化失败");
    }
  }, [onError]);

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

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

export default function Home() {
  const [config, setConfig] = useState(initial);
  const [playing, setPlaying] = useState(true);
  const [notice, setNotice] = useState("实时渲染中");
  const [fallbackCode, setFallbackCode] = useState("");
  const [webglError, setWebglError] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPlaying(false);
      setNotice("已按系统设置暂停动画");
    }
  }, []);

  const update = <Key extends keyof CardConfig>(
    key: Key,
    value: CardConfig[Key],
  ) => setConfig((current) => ({ ...current, [key]: value }));

  const randomize = () => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    const seed = values[0];
    setConfig((current) => ({
      ...current,
      ...createPreset(seed),
      seed,
    }));
    setFallbackCode("");
    setNotice(`新种子 · ${seed}`);
  };

  const copyHtml = async () => {
    const html = buildEmbed(config);
    try {
      await navigator.clipboard.writeText(html);
      setFallbackCode("");
      setNotice("HTML 已复制，可以粘贴到其他网页");
    } catch {
      setFallbackCode(html);
      setNotice("剪贴板不可用，请在下方手动复制");
    }
  };

  const cardStyle = {
    "--card-a": config.colorA,
    "--card-b": config.colorB,
    "--card-radius": `${config.radius}px`,
    "--card-width": `${config.width}px`,
    "--card-height": `${config.height}px`,
  } as CSSProperties;

  return (
    <main className="studio">
      <header className="studio-header">
        <a className="brand" href="#top" aria-label="Luma Lab 首页">
          LUMA LAB
        </a>
        <div className="header-meta">
          <span>WEBGL CARD STUDIO</span>
          <span className="live-dot" aria-hidden="true" />
          <span>{playing ? "LIVE" : "PAUSED"}</span>
        </div>
      </header>

      <section className="intro" id="top">
        <div>
          <span className="eyebrow">GENERATIVE COLOR STUDIES / 2026</span>
          <h1>把颜色变成<br />可复制的动态。</h1>
        </div>
        <p>
          编辑左侧文字，让右侧 WebGL 在粒子、波纹、雾与流动纹理之间随机生成。
          完成后复制一段自包含 HTML，带到任何支持脚本的网页。
        </p>
      </section>

      <section className="workspace" aria-label="动态卡片生成器">
        <article className="preview-card" style={cardStyle}>
          <div className="card-copy">
            <span className="card-label">{config.label}</span>
            <h2>{config.title}</h2>
            <p>{config.subtitle}</p>
            <div className="card-index">
              <span>SEED</span>
              <b>{String(config.seed).padStart(10, "0").slice(-10)}</b>
            </div>
          </div>
          <div className="card-visual">
            <WebGLPreview
              config={config}
              playing={playing}
              onError={setWebglError}
            />
            <span className="render-label">
              {webglError ? "CSS FALLBACK" : "WEBGL 2 / GLSL"}
            </span>
            {webglError && <span className="webgl-error">{webglError}</span>}
          </div>
        </article>

        <div className="toolbar" aria-label="常用操作">
          <button className="button button-primary" onClick={randomize}>
            <span aria-hidden="true">✦</span> 随机生成
          </button>
          <button className="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? "暂停" : "播放"}
          </button>
          <button className="button" onClick={copyHtml}>复制 HTML</button>
          <button
            className="button button-quiet"
            onClick={() => {
              setConfig(initial);
              setFallbackCode("");
              setNotice("已恢复默认卡片");
            }}
          >
            重置
          </button>
          <span className="toolbar-status" aria-live="polite">{notice}</span>
        </div>

        {fallbackCode && (
          <div className="manual-copy">
            <label htmlFor="export-code">手动复制 HTML</label>
            <textarea
              id="export-code"
              readOnly
              value={fallbackCode}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}

        <details className="advanced">
          <summary>
            <span>高级设置</span>
            <small>文字 · 颜色 · 尺寸 · 动效</small>
          </summary>
          <div className="control-grid">
            <label className="field field-wide">
              <span>标题</span>
              <input
                value={config.title}
                maxLength={42}
                onChange={(event) => update("title", event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>正文</span>
              <input
                value={config.subtitle}
                maxLength={80}
                onChange={(event) => update("subtitle", event.target.value)}
              />
            </label>
            <label className="field field-wide">
              <span>辅助文字</span>
              <input
                value={config.label}
                maxLength={48}
                onChange={(event) => update("label", event.target.value)}
              />
            </label>
            <label className="field color-field">
              <span>颜色 A</span>
              <input
                type="color"
                value={config.colorA}
                onChange={(event) => update("colorA", event.target.value)}
              />
              <output>{config.colorA.toUpperCase()}</output>
            </label>
            <label className="field color-field">
              <span>颜色 B</span>
              <input
                type="color"
                value={config.colorB}
                onChange={(event) => update("colorB", event.target.value)}
              />
              <output>{config.colorB.toUpperCase()}</output>
            </label>
            <RangeField label="速度" value={config.speed} min={0} max={2} step={0.05} onChange={(value) => update("speed", value)} />
            <RangeField label="强度" value={config.intensity} min={0} max={1} step={0.01} onChange={(value) => update("intensity", value)} />
            <RangeField label="圆角" value={config.radius} min={24} max={96} step={1} suffix="px" onChange={(value) => update("radius", value)} />
            <RangeField label="宽度" value={config.width} min={480} max={1600} step={20} suffix="px" onChange={(value) => update("width", value)} />
            <RangeField label="高度" value={config.height} min={220} max={900} step={10} suffix="px" onChange={(value) => update("height", value)} />
            <label className="field">
              <span>随机种子</span>
              <input
                type="number"
                min={0}
                max={4294967295}
                value={config.seed}
                onChange={(event) => update("seed", Number(event.target.value))}
              />
            </label>
          </div>
        </details>
      </section>

      <footer>
        <span>ONE CARD · ONE SHADER · ZERO DEPENDENCIES</span>
        <span>MADE WITH WEBGL 2</span>
      </footer>
    </main>
  );
}

type RangeFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
};

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: RangeFieldProps) {
  return (
    <label className="field range-field">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>{value}{suffix}</output>
    </label>
  );
}
