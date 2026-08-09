"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type { ShowcaseEntry } from "../curation/curation-core";
import { recipeFingerprint } from "../curation/curation-core";
import { CopyEmbedButton } from "../embed/copy-embed-button";
import {
  LAB_MAX_LAYERS,
  advancePhaseTimes,
  packLabRecipe,
  type PackedLabRecipe,
} from "../lab/lab-core";
import { LAB_FRAGMENT_SHADER, LAB_VERTEX_SHADER } from "../lab/lab-shader";
import { MOTION_PAGE_SIZE } from "../motion-catalog";

export type RecipeAtlasProps = {
  entries: ShowcaseEntry[];
  playing: boolean;
  onRemove?: (entryId: string) => void;
};

const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = Math.ceil(MOTION_PAGE_SIZE / ATLAS_COLUMNS);

type RecipeUniforms = {
  resolution: WebGLUniformLocation | null;
  viewportOrigin: WebGLUniformLocation | null;
  globalTime: WebGLUniformLocation | null;
  interactionStrength: WebGLUniformLocation | null;
  densityScale: WebGLUniformLocation | null;
  edgeSharpness: WebGLUniformLocation | null;
  layerCount: WebGLUniformLocation | null;
  layerTimes: WebGLUniformLocation | null;
  layerSeeds: WebGLUniformLocation | null;
  layerIntensities: WebGLUniformLocation | null;
  layerVariants: WebGLUniformLocation | null;
  layerKernels: WebGLUniformLocation | null;
  layerParams: WebGLUniformLocation | null;
  layerColorsA: WebGLUniformLocation | null;
  layerColorsB: WebGLUniformLocation | null;
  layerTransforms: WebGLUniformLocation | null;
  layerOffsets: WebGLUniformLocation | null;
  interactionModes: WebGLUniformLocation | null;
};

export function RecipeAtlas({ entries, playing, onRemove }: RecipeAtlasProps) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const entriesRef = useRef(entries);
  const playingRef = useRef(playing);
  const phaseTimesRef = useRef(new Map<string, Float32Array>());
  const elapsedRef = useRef(new Map<string, number>());
  const packedRef = useRef(new Map<string, PackedLabRecipe>());
  const drawRef = useRef<((time: number) => void) | null>(null);
  const lastNowRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
    lastNowRef.current = 0;
  }, [playing]);

  useEffect(() => {
    entriesRef.current = entries;
    phaseTimesRef.current = new Map(
      entries.map((entry) => [
        entry.id,
        phaseTimesRef.current.get(entry.id) ?? new Float32Array(LAB_MAX_LAYERS),
      ]),
    );
    elapsedRef.current = new Map(
      entries.map((entry) => [entry.id, elapsedRef.current.get(entry.id) ?? 0]),
    );
    packedRef.current = new Map(
      entries.map((entry) => [
        recipeFingerprint(entry.recipe),
        packLabRecipe(entry.recipe),
      ]),
    );
    drawRef.current?.(performance.now());
  }, [entries]);

  useEffect(() => {
    const targets = canvasRefs.current
      .slice(0, entries.length)
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));
    if (targets.length !== entries.length || targets.length === 0) return;

    const source = document.createElement("canvas");
    const gl = source.getContext("webgl2", {
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    const contexts = targets.map((canvas) => canvas.getContext("2d"));
    if (!gl || contexts.some((context) => !context)) return;

    let program: WebGLProgram | null = null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let observer: ResizeObserver | null = null;
    let resizeFrame = 0;

    const compile = (type: number, sourceCode: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create recipe atlas shader");
      gl.shaderSource(shader, sourceCode);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Recipe shader compile failed";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    try {
      vertex = compile(gl.VERTEX_SHADER, LAB_VERTEX_SHADER);
      fragment = compile(gl.FRAGMENT_SHADER, LAB_FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error("Unable to create recipe atlas program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
          gl.getProgramInfoLog(program) || "Recipe atlas link failed",
        );
      }
      gl.useProgram(program);

      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create recipe atlas buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const uniforms: RecipeUniforms = {
        resolution: gl.getUniformLocation(program, "resolution"),
        viewportOrigin: gl.getUniformLocation(program, "viewportOrigin"),
        globalTime: gl.getUniformLocation(program, "globalTime"),
        interactionStrength: gl.getUniformLocation(program, "interactionStrength"),
        densityScale: gl.getUniformLocation(program, "densityScale"),
        edgeSharpness: gl.getUniformLocation(program, "edgeSharpness"),
        layerCount: gl.getUniformLocation(program, "layerCount"),
        layerTimes: gl.getUniformLocation(program, "layerTimes[0]"),
        layerSeeds: gl.getUniformLocation(program, "layerSeeds[0]"),
        layerIntensities: gl.getUniformLocation(program, "layerIntensities[0]"),
        layerVariants: gl.getUniformLocation(program, "layerVariants[0]"),
        layerKernels: gl.getUniformLocation(program, "layerKernels[0]"),
        layerParams: gl.getUniformLocation(program, "layerParams[0]"),
        layerColorsA: gl.getUniformLocation(program, "layerColorsA[0]"),
        layerColorsB: gl.getUniformLocation(program, "layerColorsB[0]"),
        layerTransforms: gl.getUniformLocation(program, "layerTransforms[0]"),
        layerOffsets: gl.getUniformLocation(program, "layerOffsets[0]"),
        interactionModes: gl.getUniformLocation(program, "interactionModes[0]"),
      };

      let tileWidth = 1;
      let tileHeight = 1;

      drawRef.current = (now) => {
        const previous = lastNowRef.current || now;
        const delta = Math.max(0, Math.min((now - previous) * 0.001, 0.05));
        lastNowRef.current = now;
        gl.enable(gl.SCISSOR_TEST);

        entriesRef.current.forEach((entry, index) => {
          const recipe = entry.recipe;
          const phases =
            phaseTimesRef.current.get(entry.id) ??
            new Float32Array(LAB_MAX_LAYERS);
          let elapsed = elapsedRef.current.get(entry.id) ?? 0;
          if (playingRef.current) {
            elapsed += delta;
            advancePhaseTimes(recipe, phases, elapsed, delta);
          }
          phaseTimesRef.current.set(entry.id, phases);
          elapsedRef.current.set(entry.id, elapsed);

          const packed =
            packedRef.current.get(recipeFingerprint(recipe)) ??
            packLabRecipe(recipe);
          const column = index % ATLAS_COLUMNS;
          const row = Math.floor(index / ATLAS_COLUMNS);
          const atlasX = column * tileWidth;
          const atlasY = (ATLAS_ROWS - row - 1) * tileHeight;
          gl.viewport(atlasX, atlasY, tileWidth, tileHeight);
          gl.scissor(atlasX, atlasY, tileWidth, tileHeight);
          gl.uniform2f(uniforms.resolution, tileWidth, tileHeight);
          gl.uniform2f(uniforms.viewportOrigin, atlasX, atlasY);
          gl.uniform1f(uniforms.globalTime, elapsed);
          gl.uniform1f(uniforms.interactionStrength, packed.interactionStrength);
          gl.uniform1f(uniforms.densityScale, packed.densityScale);
          gl.uniform1f(uniforms.edgeSharpness, packed.edgeSharpness);
          gl.uniform1i(uniforms.layerCount, recipe.effectCount);
          gl.uniform1fv(uniforms.layerTimes, phases);
          gl.uniform1fv(uniforms.layerSeeds, packed.seeds);
          gl.uniform1fv(uniforms.layerIntensities, packed.intensities);
          gl.uniform1iv(uniforms.layerVariants, packed.variants);
          gl.uniform1iv(uniforms.layerKernels, packed.kernels);
          gl.uniform4fv(uniforms.layerParams, packed.params);
          gl.uniform3fv(uniforms.layerColorsA, packed.colorsA);
          gl.uniform3fv(uniforms.layerColorsB, packed.colorsB);
          gl.uniform4fv(uniforms.layerTransforms, packed.transforms);
          gl.uniform2fv(uniforms.layerOffsets, packed.offsets);
          gl.uniform1iv(uniforms.interactionModes, packed.modes);
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
        const width = Math.max(1, Math.round(box.width * ratio));
        const height = Math.max(1, Math.round(box.height * ratio));
        if (tileWidth === width && tileHeight === height) return;
        tileWidth = width;
        tileHeight = height;
        source.width = tileWidth * ATLAS_COLUMNS;
        source.height = tileHeight * ATLAS_ROWS;
        targets.forEach((target) => {
          target.width = tileWidth;
          target.height = tileHeight;
        });
        drawRef.current?.(performance.now());
      };

      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(resize);
      });
      observer.observe(targets[0]);
      resize();
    } catch (error) {
      console.warn("SPECTRA recipe atlas fallback", error);
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      drawRef.current = null;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    };
  }, [entries.length]);

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
    <div className="atlas-gallery recipe-atlas">
      {entries.map((entry, index) => {
        const recipe = entry.recipe;
        const cardStyle = {
          "--card-a": recipe.palette[0],
          "--card-b": recipe.palette[1] ?? recipe.palette[0],
          "--card-radius": "10px",
          "--card-width": "400px",
          "--card-height": "100px",
        } as CSSProperties;
        return (
          <div className="card-study" key={entry.id}>
            <span className="study-meta">
              {entry.source === "library" ? "单效果" : "随机混合"} · {recipe.effectCount} 层 · {recipe.paletteName} · <time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString("zh-CN")}</time>
            </span>
            <article
              className="preview-card"
              style={cardStyle}
              aria-label={`SPECTRA ${recipe.effectCount} 层动态配方`}
            >
              <div className="card-copy">
                <h2>SPECTRA</h2>
                <p>COLOR AS A LIVING SYSTEM.</p>
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
            <details className="recipe-details">
              <summary>查看配方</summary>
              <ol>
                {recipe.layers.map((layer) => (
                  <li key={`${entry.id}-${layer.studyId}`}>{layer.name}</li>
                ))}
              </ol>
            </details>
            <div className="card-actions">
              <CopyEmbedButton recipe={recipe} />
              {onRemove ? (
                <button onClick={() => onRemove(entry.id)}>从首页删除</button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
