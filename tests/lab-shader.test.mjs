import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  LAB_FRAGMENT_SHADER,
  LAB_VERTEX_SHADER,
} from "../app/lab/lab-shader.ts";

test("shader has six slots and one active-layer loop", () => {
  assert.match(LAB_VERTEX_SHADER, /gl_Position/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform int layerCount;/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform float interactionStrength;/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform vec2 viewportOrigin;/);
  assert.match(
    LAB_FRAGMENT_SHADER,
    /vec2 uv = \(gl_FragCoord\.xy - viewportOrigin\) \/ resolution\.xy;/,
  );
  assert.match(LAB_FRAGMENT_SHADER, /uniform float layerTimes\[6\];/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform int layerKernels\[6\];/);
  assert.match(LAB_FRAGMENT_SHADER, /for\(int i = 0; i < 6; i\+\+\)/);
  assert.match(LAB_FRAGMENT_SHADER, /if\(i >= layerCount\) break;/);
});

test("shader reuses study rendering and has six interactions", () => {
  assert.match(LAB_FRAGMENT_SHADER, /vec3 renderStudy\(vec2 uv\)/);
  assert.match(LAB_FRAGMENT_SHADER, /vec3 interactLayers\(/);
  [0, 1, 2, 3, 4, 5].forEach((mode) => {
    assert.match(LAB_FRAGMENT_SHADER, new RegExp(`mode == ${mode}`));
  });
  assert.match(LAB_FRAGMENT_SHADER, /interactionWarp \+=/);
  assert.match(LAB_FRAGMENT_SHADER, /seam \* 0\.34 \* interactionStrength/);
  assert.match(LAB_FRAGMENT_SHADER, /layerMask \* interactionStrength/);
  assert.match(
    LAB_FRAGMENT_SHADER,
    /transform\.w \* interactionStrength/,
  );
  assert.doesNotMatch(
    LAB_FRAGMENT_SHADER,
    /sampler2D|framebuffer|particles/i,
  );
});

test("shader preserves white entry and compresses dense color", () => {
  assert.match(
    LAB_FRAGMENT_SHADER,
    /smoothstep\(0\.0, 0\.18, uv\.x\)/,
  );
  assert.match(
    LAB_FRAGMENT_SHADER,
    /color = color \/ \(vec3\(0\.82\) \+ color \* 0\.28\)/,
  );
});

test("shader exposes advanced density edge and composition uniforms", () => {
  assert.match(LAB_FRAGMENT_SHADER, /uniform float densityScale;/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform float edgeSharpness;/);
  assert.match(LAB_FRAGMENT_SHADER, /uniform vec2 layerOffsets\[6\];/);
});

test("both mixed-card renderers upload advanced uniforms", async () => {
  const previewSource = await readFile("app/lab/lab-preview.tsx", "utf8");
  const atlasSource = await readFile("app/render/recipe-atlas.tsx", "utf8");
  for (const source of [previewSource, atlasSource]) {
    assert.match(source, /uniform1f\([^\n]*densityScale/);
    assert.match(source, /uniform1f\([^\n]*edgeSharpness/);
    assert.match(source, /uniform2fv\([^\n]*layerOffsets/);
  }
});
