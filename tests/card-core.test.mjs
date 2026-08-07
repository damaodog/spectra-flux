import assert from "node:assert/strict";
import test from "node:test";
import { buildEmbed, createPreset } from "../app/card-core.ts";

test("createPreset is deterministic for a seed", () => {
  assert.deepEqual(createPreset(2026), createPreset(2026));
  assert.notDeepEqual(createPreset(2026), createPreset(2027));
});

test("buildEmbed escapes copy and has no network dependency", () => {
  const config = {
    title: "<SPECTRA>",
    subtitle: "COLOR & MOTION",
    label: "WEBGL / 001",
    colorA: "#ff866f",
    colorB: "#718cff",
    seed: 2026,
    speed: 0.8,
    intensity: 0.72,
    radius: 64,
    width: 1200,
    height: 420,
  };

  const html = buildEmbed(config);

  assert.match(html, /&lt;SPECTRA&gt;/);
  assert.match(html, /getContext\("webgl2"/);
  assert.match(html, /2026/);
  assert.doesNotMatch(html, /https?:\/\//);
});
