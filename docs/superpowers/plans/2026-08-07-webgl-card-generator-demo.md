# WebGL Card Generator Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a one-page WebGL card generator that previews a procedural animation and copies a self-contained HTML embed.

**Architecture:** Keep the demo to one client page, one stylesheet, and one pure TypeScript module. The pure module owns deterministic presets, GLSL source, escaping, and embed generation; the page owns React state and the single WebGL preview context.

**Tech Stack:** React 19, TypeScript, native WebGL2/GLSL, native Clipboard API, CSS, Node test runner, Vinext/Sites.

## Global Constraints

- Desktop card layout is approximately 35% text and 65% animation; mobile stacks text above animation.
- Export is one self-contained HTML fragment with inline style, inline script, and no network dependency.
- Card width is 480–1600 px, height 220–900 px, radius 24–96 px, speed 0–2, and intensity 0–1.
- Use one WebGL2 context and one full-screen draw call per animation frame.
- If WebGL2 is unavailable, retain the CSS gradient fallback.
- Respect `prefers-reduced-motion` and stop drawing while paused or hidden.
- Demo scope excludes accounts, persistence, template libraries, share links, and media export.

---

### Task 1: Deterministic presets and self-contained export

**Files:**
- Create: `app/card-core.ts`
- Create: `tests/card-core.test.mjs`

**Interfaces:**
- Produces: `CardConfig`, `createPreset(seed)`, `buildEmbed(config)`, `VERTEX_SHADER`, and `FRAGMENT_SHADER`.
- Consumes: no application code; only native JavaScript and WebGL APIs embedded as strings.

- [ ] **Step 1: Initialize the Sites starter and keep its package manager and build structure**

Run the bundled Sites initializer against the project root, install dependencies through that initializer, start `npm run dev`, and open the exact printed local URL once.

- [ ] **Step 2: Write the failing core tests**

```js
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
```

- [ ] **Step 3: Run the core test and verify RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because `app/card-core.ts` does not exist.

- [ ] **Step 4: Implement the minimal pure core**

Create `app/card-core.ts` with this public shape and behavior:

```ts
export type CardConfig = {
  title: string;
  subtitle: string;
  label: string;
  colorA: string;
  colorB: string;
  seed: number;
  speed: number;
  intensity: number;
  radius: number;
  width: number;
  height: number;
};

export const VERTEX_SHADER = `#version 300 es
in vec2 position;
void main(){ gl_Position = vec4(position, 0.0, 1.0); }`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float seed;
uniform float intensity;
uniform vec3 colorA;
uniform vec3 colorB;
out vec4 outColor;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+seed)*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y); }
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy; vec2 p=(uv-.5)*vec2(resolution.x/resolution.y,1.0);
  float fog=noise(p*3.0+time*.08)+.5*noise(p*7.0-time*.05);
  float wave=.5+.5*sin(12.0*length(p-vec2(sin(time*.13),cos(time*.11))*.18)-time*1.3+fog*2.0);
  float grain=smoothstep(.965,1.0,hash(floor((p+time*.01)*90.0)));
  float mixValue=clamp(.18+fog*.56+wave*.18*intensity+grain*.12,0.0,1.0);
  vec3 color=mix(vec3(.985),mix(colorA,colorB,mixValue),smoothstep(.0,.72,uv.x));
  outColor=vec4(color,1.0);
}`;

export function createPreset(seed: number) {
  let value = seed >>> 0;
  const random = () => {
    value += 0x6d2b79f5;
    let next = value;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  const palettes = [
    ["#ff896f", "#788dff"],
    ["#75d8ff", "#6b63ff"],
    ["#f2d95c", "#aa7cff"],
    ["#64e0c1", "#2778ff"],
    ["#ff7eb8", "#ffb45e"],
  ] as const;
  const colors = palettes[Math.floor(random() * palettes.length)];
  return {
    colorA: colors[0],
    colorB: colors[1],
    speed: Number((0.45 + random() * 1.15).toFixed(2)),
    intensity: Number((0.45 + random() * 0.5).toFixed(2)),
  };
}
```

Also implement `buildEmbed(config)` in the same file. It must escape copy, clamp numeric values to the global bounds, emit a scoped root/canvas/style/script fragment, compile the exported shader strings with `getContext("webgl2")`, draw only while visible, and leave the CSS gradient visible if context creation fails.

- [ ] **Step 5: Run the core test and verify GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: 2 tests pass, 0 fail.

- [ ] **Step 6: Commit the core behavior**

```bash
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: add deterministic WebGL card export"
```

### Task 2: One-page generator UI

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Replace: `app/page.tsx`
- Replace: `app/globals.css`
- Modify: `app/layout.tsx`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `CardConfig`, `createPreset`, `buildEmbed`, `VERTEX_SHADER`, and `FRAGMENT_SHADER` from Task 1.
- Produces: the `/` generator route and its accessible interactive controls.

- [ ] **Step 1: Replace the starter render test with the failing product test**

Keep the starter test's `render()` helper and replace its assertions with:

```js
test("server-renders the WebGL card generator", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>LUMA LAB — WebGL Card Generator<\/title>/i);
  assert.match(html, /COLOR AS A LIVING SYSTEM\./);
  assert.match(html, /随机生成/);
  assert.match(html, /复制 HTML/);
  assert.match(html, /高级设置/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);
});
```

- [ ] **Step 2: Run the product test and verify RED**

Run: `npm test`

Expected: FAIL because the starter title and loading skeleton still render.

- [ ] **Step 3: Implement the generator page**

Replace `app/page.tsx` with a client component that:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildEmbed,
  createPreset,
  FRAGMENT_SHADER,
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
};
```

Define one internal `WebGLPreview` component that compiles the imported shaders, uploads `resolution`, `time`, `seed`, `intensity`, `colorA`, and `colorB`, renders one full-screen triangle strip, pauses on `playing === false` or `document.hidden`, and reports initialization failure through a small status label. Define the exported `Home` component with `useState(initial)`, live text/color/range inputs, random generation from `crypto.getRandomValues`, playback toggle, reset, and `navigator.clipboard.writeText(buildEmbed(config))`. If clipboard writing fails, reveal a read-only textarea containing the generated fragment.

The returned markup must contain: a small `LUMA LAB / WEBGL CARD STUDIO` header; one large preview card with `.card-copy` and `.card-visual`; the visible buttons “随机生成”, “暂停/播放”, “复制 HTML”, and “重置”; and a native `<details>` labeled “高级设置” containing all editable fields.

- [ ] **Step 4: Implement the visual system and metadata**

Replace `app/globals.css` with a responsive cold-white studio layout. Use system fonts, a dotted technical wordmark, a large white rounded card, 35/65 desktop columns, a stacked mobile layout below 760 px, visible focus styles, and a CSS gradient fallback behind the canvas. Add reduced-motion rules.

Update `app/layout.tsx` to use `lang="zh-CN"`, remove remote font imports/classes, and set title `LUMA LAB — WebGL Card Generator` plus a matching Chinese description.

Delete `app/_sites-preview`, uninstall `react-loading-skeleton`, and refresh the lockfile.

- [ ] **Step 5: Run the product test and verify GREEN**

Run: `npm test`

Expected: build succeeds and all rendered HTML plus core tests pass.

- [ ] **Step 6: Commit the UI**

```bash
git add app tests package.json package-lock.json
git commit -m "feat: build WebGL card generator demo"
```

### Task 3: Validate and publish

**Files:**
- Modify: `.openai/hosting.json` only when the Sites publish flow assigns a project ID.

**Interfaces:**
- Consumes: the complete generator from Tasks 1–2.
- Produces: a private deployed Sites URL.

- [ ] **Step 1: Run final verification**

Run: `npm test && npm run build`

Expected: every test passes and the deployment build exits with code 0.

- [ ] **Step 2: Publish the exact validated source**

Use Sites hosting to create the private site, save the returned project ID, commit the validated source, package the build, save one version, deploy privately, and poll until deployment succeeds.

- [ ] **Step 3: Open the deployed URL and hand it off**

Open the exact deployed URL in Codex and return it as the primary deliverable.
