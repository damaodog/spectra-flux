"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";
import {
  FRAGMENT_SHADER,
  SMOKE_TIME_SCALE,
  VERTEX_SHADER,
  hexToRgb,
  toShaderSeed,
  type CardConfig,
} from "../card-core";
import { MOTION_PAGE_SIZE, MOTION_STUDIES } from "../motion-catalog";

export type AtomicAtlasProps = {
  configs: CardConfig[];
  playing: boolean;
  actions?: (config: CardConfig) => ReactNode;
};

const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = Math.ceil(MOTION_PAGE_SIZE / ATLAS_COLUMNS);

export function AtomicAtlas({ configs, playing, actions }: AtomicAtlasProps) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const paramsRef = useRef(configs);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    paramsRef.current = configs;
    drawRef.current?.(lastTimeRef.current);
  }, [configs]);

  useEffect(() => {
    const targets = canvasRefs.current
      .slice(0, configs.length)
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
    if (targets.length !== configs.length || targets.length === 0) return;

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
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const nextTileWidth = Math.max(1, Math.round(box.width * ratio));
        const nextTileHeight = Math.max(1, Math.round(box.height * ratio));
        if (tileWidth === nextTileWidth && tileHeight === nextTileHeight) return;
        tileWidth = nextTileWidth;
        tileHeight = nextTileHeight;
        const sourceWidth = tileWidth * ATLAS_COLUMNS;
        const sourceHeight = tileHeight * ATLAS_ROWS;
        if (source.width !== sourceWidth) source.width = sourceWidth;
        if (source.height !== sourceHeight) source.height = sourceHeight;
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
        if (buffer) gl.deleteBuffer(buffer);
        drawRef.current = null;
      };
    } catch (error) {
      console.warn("SPECTRA atomic atlas fallback", error);
    }
  }, [configs.length]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const draw = (now: number) => {
      if (!document.hidden) drawRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return (
    <div className="atlas-gallery">
      {configs.map((config, index) => {
        const motionStudy = MOTION_STUDIES.find(({ id }) => id === config.studyId);
        const studyNumber = String(config.studyId + 1).padStart(2, "0");
        const studyName = motionStudy?.name ?? config.label;
        const cardStyle = {
          "--card-a": config.colorA,
          "--card-b": config.colorB,
          "--card-radius": `${config.radius}px`,
          "--card-width": `${config.width}px`,
          "--card-height": `${config.height}px`,
        } as CSSProperties;

        return (
          <div className="card-study" key={config.studyId}>
            <span className="study-meta">{`${studyNumber} · ${studyName}`}</span>
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
            {actions ? <div className="card-actions">{actions(config)}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
