import assert from "node:assert/strict";
import test from "node:test";
import { buildEmbed, FRAGMENT_SHADER } from "../app/card-core.ts";

test("the six appended catalog families have GLSL fields and routes", () => {
  [
    "liquidMetalField",
    "biomorphicField",
    "geologicalField",
    "acousticField",
    "topologyField",
    "phaseChangeField",
  ].forEach((name) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`vec4 ${name}\\(`));
  });
  [45, 46, 47, 48, 49, 50].forEach((kernel) => {
    assert.match(FRAGMENT_SHADER, new RegExp(`if\\(kernel == ${kernel}\\)`));
  });
  assert.match(FRAGMENT_SHADER, /bool liquidMetalKernel = kernel == 45;/);
  assert.match(FRAGMENT_SHADER, /bool phaseChangeKernel = kernel == 50;/);
});

test("atomic embed preserves the highest appended kernel", () => {
  const html = buildEmbed({
    title: "SPECTRA",
    subtitle: "COLOR AS A LIVING SYSTEM.",
    label: "144 · 状态跃迁",
    colorA: "#ff896f",
    colorB: "#788dff",
    seed: 144,
    speed: 0.64,
    intensity: 0.7,
    radius: 54,
    width: 400,
    height: 100,
    studyId: 143,
    variant: 143,
    kernel: 50,
    params: [0.92, 0.82, 0.68, 0.84],
  });
  assert.match(html, /uniform1i\(kernel,50\)/);
});
