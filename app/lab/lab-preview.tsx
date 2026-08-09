"use client";

import { useEffect, useRef } from "react";
import {
  LAB_MAX_LAYERS,
  advancePhaseTimes,
  packLabRecipe,
  type LabRecipe,
} from "./lab-core";
import { LAB_FRAGMENT_SHADER, LAB_VERTEX_SHADER } from "./lab-shader";

export type LabPreviewProps = {
  recipe: LabRecipe;
  playing: boolean;
  onFallbackChange: (fallback: boolean) => void;
};

export function LabPreview({
  recipe,
  playing,
  onFallbackChange,
}: LabPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recipeRef = useRef(recipe);
  const playingRef = useRef(playing);
  const fallbackCallbackRef = useRef(onFallbackChange);
  const phasesRef = useRef(new Float32Array(LAB_MAX_LAYERS));
  const elapsedRef = useRef(0);
  const lastNowRef = useRef(0);
  const uploadRecipeRef = useRef<((next: LabRecipe) => void) | null>(null);
  const drawRef = useRef<((now: number) => void) | null>(null);

  useEffect(() => {
    fallbackCallbackRef.current = onFallbackChange;
  }, [onFallbackChange]);

  useEffect(() => {
    playingRef.current = playing;
    lastNowRef.current = 0;
  }, [playing]);

  useEffect(() => {
    recipeRef.current = recipe;
    phasesRef.current.fill(0);
    elapsedRef.current = 0;
    lastNowRef.current = 0;
    uploadRecipeRef.current?.(recipe);
    drawRef.current?.(performance.now());
  }, [recipe]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
    });
    if (!gl) {
      fallbackCallbackRef.current(true);
      return;
    }

    let program: WebGLProgram | null = null;
    let vertex: WebGLShader | null = null;
    let fragment: WebGLShader | null = null;
    let buffer: WebGLBuffer | null = null;
    let resizeFrame = 0;
    let observer: ResizeObserver | null = null;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Unable to create lab shader");
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) || "Lab shader compile failed";
        gl.deleteShader(shader);
        throw new Error(message);
      }
      return shader;
    };

    try {
      vertex = compile(gl.VERTEX_SHADER, LAB_VERTEX_SHADER);
      fragment = compile(gl.FRAGMENT_SHADER, LAB_FRAGMENT_SHADER);
      program = gl.createProgram();
      if (!program) throw new Error("Unable to create lab program");
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "Lab program link failed");
      }
      gl.useProgram(program);

      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create lab vertex buffer");
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
        globalTime: gl.getUniformLocation(program, "globalTime"),
        layerCount: gl.getUniformLocation(program, "layerCount"),
        layerTimes: gl.getUniformLocation(program, "layerTimes[0]"),
        layerSeeds: gl.getUniformLocation(program, "layerSeeds[0]"),
        layerIntensities: gl.getUniformLocation(
          program,
          "layerIntensities[0]",
        ),
        layerVariants: gl.getUniformLocation(program, "layerVariants[0]"),
        layerKernels: gl.getUniformLocation(program, "layerKernels[0]"),
        layerParams: gl.getUniformLocation(program, "layerParams[0]"),
        layerColorsA: gl.getUniformLocation(program, "layerColorsA[0]"),
        layerColorsB: gl.getUniformLocation(program, "layerColorsB[0]"),
        layerTransforms: gl.getUniformLocation(program, "layerTransforms[0]"),
        interactionModes: gl.getUniformLocation(
          program,
          "interactionModes[0]",
        ),
      };

      uploadRecipeRef.current = (next) => {
        const packed = packLabRecipe(next);
        gl.useProgram(program);
        gl.uniform1i(uniforms.layerCount, next.effectCount);
        gl.uniform1fv(uniforms.layerSeeds, packed.seeds);
        gl.uniform1fv(uniforms.layerIntensities, packed.intensities);
        gl.uniform1iv(uniforms.layerVariants, packed.variants);
        gl.uniform1iv(uniforms.layerKernels, packed.kernels);
        gl.uniform4fv(uniforms.layerParams, packed.params);
        gl.uniform3fv(uniforms.layerColorsA, packed.colorsA);
        gl.uniform3fv(uniforms.layerColorsB, packed.colorsB);
        gl.uniform4fv(uniforms.layerTransforms, packed.transforms);
        gl.uniform1iv(uniforms.interactionModes, packed.modes);
      };

      drawRef.current = (now) => {
        if (document.hidden) return;
        const previous = lastNowRef.current || now;
        const delta = Math.max(0, (now - previous) * 0.001);
        lastNowRef.current = now;
        if (playingRef.current) {
          elapsedRef.current += Math.min(delta, 0.05);
          advancePhaseTimes(
            recipeRef.current,
            phasesRef.current,
            elapsedRef.current,
            delta,
          );
        }
        gl.useProgram(program);
        gl.uniform1f(uniforms.globalTime, elapsedRef.current);
        gl.uniform1fv(uniforms.layerTimes, phasesRef.current);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };

      const resize = () => {
        const box = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        const width = Math.max(1, Math.round(box.width * ratio));
        const height = Math.max(1, Math.round(box.height * ratio));
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(uniforms.resolution, width, height);
        gl.uniform2f(uniforms.viewportOrigin, 0, 0);
        drawRef.current?.(performance.now());
      };

      observer = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(resize);
      });
      observer.observe(canvas);
      uploadRecipeRef.current(recipeRef.current);
      resize();
      fallbackCallbackRef.current(false);
    } catch (error) {
      console.warn("SPECTRA lab WebGL fallback", error);
      fallbackCallbackRef.current(true);
    }

    return () => {
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      uploadRecipeRef.current = null;
      drawRef.current = null;
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      if (vertex) gl.deleteShader(vertex);
      if (fragment) gl.deleteShader(fragment);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const draw = (now: number) => {
      drawRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
