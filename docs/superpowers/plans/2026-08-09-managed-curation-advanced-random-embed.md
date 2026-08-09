# Managed Curation, Advanced Random, and Embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add secure shared homepage curation, richer constrained random generation, and portable single-card iframe export without changing SPECTRA FLUX's current visual language.

**Architecture:** Keep rendering and recipe generation in the existing Next.js application, move shared curation and administrator authentication behind the Cloudflare Worker, and store the public curated state in Cloudflare KV. Encode complete recipes into embed URLs so exported cards stay reproducible even if the homepage changes. Preserve version-1 browser data through an explicit administrator migration flow.

**Tech Stack:** Next.js 15, React 19, TypeScript, WebGL/GLSL, Cloudflare Workers, Cloudflare KV, Web Crypto, Node test runner, ESLint, Wrangler.

## Global Constraints

- Continue using one WebGL context and the current card renderer; do not add a fluid-simulation dependency.
- The public can browse, randomize, and copy embed HTML. Only an authenticated administrator can add or remove showcase recipes, delete atomic studies, or migrate curated state.
- The administrator password is a Worker secret. Never commit it, serialize it into HTML, or expose it through a client bundle.
- The administrator session is an encrypted or signed `HttpOnly`, `Secure`, `SameSite=Strict`, path-wide session cookie with no persistent expiry.
- Shared curation is the only authoritative homepage state after migration. Local storage is read only to offer the one-time migration.
- Version-1 curated data and recipes must normalize to version 2 without changing their visible result.
- An embed URL contains the full normalized recipe. Removing a recipe from the homepage or library must not break an existing embed.
- Embed rendering pauses when offscreen and respects `prefers-reduced-motion`.
- Every functional task starts with a failing test and ends with the narrow test, the full suite, lint, and a focused commit.

---

### Task 1: Introduce recipe and curation schema version 2

**Files:**

- Modify: `app/lab/lab-core.ts`
- Modify: `app/curation/curation-core.ts`
- Modify: `tests/lab-core.test.mjs`
- Modify: `tests/curation-core.test.mjs`

**Step 1: Write failing compatibility tests**

Add assertions that a version-1 recipe receives stable defaults and a version-1 curation export becomes version 2:

```js
test("normalizes a version-one recipe with version-two motion defaults", () => {
  const normalized = normalizeLabRecipe(versionOneRecipe);

  assert.equal(normalized.interactionBias, "free");
  assert.equal(normalized.rhythm, "wander");
  assert.equal(normalized.composition, "automatic");
  assert.equal(normalized.density, "standard");
  assert.equal(normalized.edge, "mixed");
  assert.equal(normalized.densityScale, 1);
  assert.equal(normalized.edgeSharpness, 1);
  assert.deepEqual(
    normalized.layers.map((layer) => [layer.offsetX, layer.offsetY, layer.speed.surgeMix]),
    normalized.layers.map(() => [0, 0, 0.18]),
  );
});

test("upgrades a version-one curation export without dropping recipes", () => {
  const upgraded = normalizeCurationState({
    version: 1,
    deletedStudyIds: [7],
    showcase: [
      {
        id: "legacy-entry",
        createdAt: 1_800_000_000_000,
        source: "lab",
        recipe: versionOneRecipe,
      },
    ],
  });

  assert.equal(upgraded.version, 2);
  assert.deepEqual(upgraded.deletedStudyIds, [7]);
  assert.equal(upgraded.showcase.length, 1);
  assert.equal(upgraded.showcase[0].recipe.rhythm, "wander");
});
```

Use the existing deterministic recipe fixture in each test file as `versionOneRecipe`; remove the new fields from a copied object before normalization so the fixture remains executable.

**Step 2: Run the narrow tests and confirm failure**

Run:

```powershell
node --test tests/lab-core.test.mjs tests/curation-core.test.mjs
```

Expected: failures report missing `normalizeLabRecipe`, version `1`, or undefined version-2 fields.

**Step 3: Add the version-2 types and normalizer**

In `app/lab/lab-core.ts`, export these selection and resolved types:

```ts
export type InteractionBias =
  | "random"
  | "free"
  | "blend"
  | "collision"
  | "weave"
  | "erode"
  | "light"
  | "difference";
export type RhythmDirection =
  | "random"
  | "wander"
  | "breath"
  | "alternating"
  | "pulse"
  | "flow";
export type CompositionDirection =
  | "random"
  | "automatic"
  | "horizontal"
  | "center-collision"
  | "pincer"
  | "vortex"
  | "interlace";
export type DensityDirection = "random" | "thin" | "standard" | "dense";
export type EdgeDirection = "random" | "soft" | "mixed" | "sharp";

export type ResolvedInteractionBias = Exclude<InteractionBias, "random">;
export type ResolvedRhythm = Exclude<RhythmDirection, "random">;
export type ResolvedComposition = Exclude<CompositionDirection, "random">;
export type ResolvedDensity = Exclude<DensityDirection, "random">;
export type ResolvedEdge = Exclude<EdgeDirection, "random">;
```

Extend the existing structures exactly as follows:

```ts
export interface SpeedProfile {
  min: number;
  max: number;
  wanderRate: number;
  surgeRate: number;
  surgeMix: number;
  seed: number;
}

export interface LabLayer {
  studyId: number;
  name: string;
  chapter: number;
  variant: number;
  kernel: number;
  params: readonly [number, number, number, number];
  seed: number;
  intensity: number;
  scale: number;
  angle: number;
  warp: number;
  weight: number;
  colorA: string;
  colorB: string;
  speed: SpeedProfile;
  offsetX: number;
  offsetY: number;
}

export interface LabRecipe {
  seed: number;
  effectCount: number;
  mixIntensity: MixIntensity;
  interactionStrength: number;
  paletteName: string;
  paletteDirection: RecipePaletteDirection;
  palette: string[];
  layers: LabLayer[];
  interactions: number[];
  interactionBias: ResolvedInteractionBias;
  rhythm: ResolvedRhythm;
  composition: ResolvedComposition;
  density: ResolvedDensity;
  edge: ResolvedEdge;
  densityScale: number;
  edgeSharpness: number;
}
```

Add `normalizeLabRecipe(value: unknown): LabRecipe | null`. It must validate required version-1 fields, clamp numeric input using the file's existing helpers, copy arrays rather than retaining caller references, and supply these defaults:

```ts
const LEGACY_RECIPE_DEFAULTS = {
  interactionBias: "free",
  rhythm: "wander",
  composition: "automatic",
  density: "standard",
  edge: "mixed",
  densityScale: 1,
  edgeSharpness: 1,
  offsetX: 0,
  offsetY: 0,
  surgeMix: 0.18,
} as const;
```

Change `app/curation/curation-core.ts` to export `CurationStateV2` with `version: 2`, `deletedStudyIds`, and `showcase`. Use `normalizeLabRecipe` for every inbound showcase recipe, and make `normalizeCurationState` accept both version 1 and version 2 input. Preserve deleted study ids and showcase metadata during upgrade; serialization must always emit version 2. Keep `normalizeRecipe` as a compatibility alias of `normalizeLabRecipe` so current callers do not break in the same commit.

**Step 4: Run compatibility tests**

Run:

```powershell
node --test tests/lab-core.test.mjs tests/curation-core.test.mjs
```

Expected: all lab and curation tests pass.

**Step 5: Run the complete checks**

Run:

```powershell
npm test
npm run lint
```

Expected: the current 65 tests plus the new compatibility tests pass; ESLint exits with code 0.

**Step 6: Commit**

```powershell
git add app/lab/lab-core.ts app/curation/curation-core.ts tests/lab-core.test.mjs tests/curation-core.test.mjs
git commit -m "feat: version generated card recipes"
```

---

### Task 2: Add five constrained random dimensions

**Files:**

- Modify: `app/lab/lab-core.ts`
- Modify: `tests/lab-core.test.mjs`

**Step 1: Write failing deterministic-generation tests**

Cover all five groups, deterministic output, and backward-compatible defaults:

```js
test("resolves advanced random constraints deterministically", () => {
  const settings = {
    effectCount: 4,
    mixIntensity: "intense",
    speedMin: 0.4,
    speedMax: 2.4,
    paletteDirection: "random",
    interactionBias: "collision",
    rhythm: "alternating",
    composition: "center-collision",
    density: "dense",
    edge: "sharp",
  };

  const first = createLabRecipe(settings, 8128, studies);
  const second = createLabRecipe(settings, 8128, studies);

  assert.deepEqual(first, second);
  assert.equal(first.interactionBias, "collision");
  assert.equal(first.rhythm, "alternating");
  assert.equal(first.composition, "center-collision");
  assert.equal(first.density, "dense");
  assert.equal(first.edge, "sharp");
  assert.ok(first.densityScale > 1);
  assert.ok(first.edgeSharpness > 1);
  assert.ok(first.layers.some((layer) => layer.offsetX < 0));
  assert.ok(first.layers.some((layer) => layer.offsetX > 0));
});

test("random advanced constraints resolve to concrete recipe values", () => {
  const recipe = createLabRecipe(
    {
      effectCount: 3,
      mixIntensity: "balanced",
      speedMin: 0.25,
      speedMax: 3,
      paletteDirection: "random",
      interactionBias: "random",
      rhythm: "random",
      composition: "random",
      density: "random",
      edge: "random",
    },
    144,
    studies,
  );

  assert.notEqual(recipe.interactionBias, "random");
  assert.notEqual(recipe.rhythm, "random");
  assert.notEqual(recipe.composition, "random");
  assert.notEqual(recipe.density, "random");
  assert.notEqual(recipe.edge, "random");
});
```

**Step 2: Run the test and confirm failure**

```powershell
node --test tests/lab-core.test.mjs
```

Expected: the generated recipe does not expose or honor the advanced constraints.

**Step 3: Extend `LabSettings` and resolve settings before layer creation**

Add optional properties to `LabSettings` so old calls stay valid:

```ts
export interface LabSettings {
  effectCount: number;
  mixIntensity: number;
  speedMin: number;
  speedMax: number;
  paletteDirection: PaletteDirection;
  interactionBias?: InteractionBias;
  rhythm?: RhythmDirection;
  composition?: CompositionDirection;
  density?: DensityDirection;
  edge?: EdgeDirection;
}
```

Resolve omitted settings to the legacy defaults and `"random"` settings with the recipe's seeded random source. Use these fixed mappings:

```ts
const DENSITY_SCALE: Record<ResolvedDensity, number> = {
  thin: 0.72,
  standard: 1,
  dense: 1.42,
};

const EDGE_SHARPNESS: Record<ResolvedEdge, number> = {
  soft: 0.68,
  mixed: 1,
  sharp: 1.55,
};

const RHYTHM_SURGE_MIX: Record<ResolvedRhythm, number> = {
  wander: 0.18,
  breath: 0.32,
  alternating: 0.58,
  pulse: 0.72,
  flow: 0.1,
};
```

Apply composition through per-layer `offsetX`, `offsetY`, and the existing `angle`. Keep offsets within `[-0.42, 0.42]`; give `horizontal` layers left/right starting positions and near-horizontal angles, alternate inward angles for `center-collision`, split outer and inner lanes for `pincer`, distribute angles tangentially around the center for `vortex`, and alternate axes and crossing angles for `interlace`.

Map `interactionBias` to the existing interaction mode selection by restricting or weighting the existing mode pool. It must alter mode selection and weights only; do not branch to separate renderers.

Update `velocityAt` to combine the existing smooth value-noise wander term with a continuous sinusoidal surge term, blending them by `surgeMix` and sharpening only the high `pulse` range into occasional bursts. Give `breath` low rates and a narrow central span, `alternating` a clear full-span wave, `pulse` long low-speed sections with brief high-speed peaks, and `flow` a narrow span in the upper half of the allowed interval. Keep every output inside the user-selected speed minimum and maximum; no rhythm is a linear fast-to-slow transition.

Apply density in two places: adjust generated layer intensity and weight within their existing safe ranges, then store the recipe-level `densityScale` for shader frequency. This makes `thin` and `dense` visibly distinct without increasing layer count or adding render passes.

**Step 4: Run the lab tests**

```powershell
node --test tests/lab-core.test.mjs
```

Expected: deterministic and constraint tests pass.

**Step 5: Run all checks and commit**

```powershell
npm test
npm run lint
git add app/lab/lab-core.ts tests/lab-core.test.mjs
git commit -m "feat: add advanced random motion constraints"
```

---

### Task 3: Render density, edge, composition, and rhythm controls

**Files:**

- Modify: `app/lab/lab-core.ts`
- Modify: `app/lab/lab-shader.ts`
- Modify: `app/lab/lab-preview.tsx`
- Modify: `app/render/recipe-atlas.tsx`
- Modify: `tests/lab-shader.test.mjs`
- Modify: `tests/lab-core.test.mjs`

**Step 1: Write failing packer and shader-contract tests**

Import `readFile` from `node:fs/promises` in `tests/lab-shader.test.mjs`, then add:

```js
test("packs advanced recipe controls for the WebGL renderer", () => {
  const recipe = createLabRecipe(advancedSettings, 55, studies);
  const packed = packLabRecipe(recipe);

  assert.equal(packed.densityScale, recipe.densityScale);
  assert.equal(packed.edgeSharpness, recipe.edgeSharpness);
  assert.equal(packed.offsets.length, LAB_MAX_LAYERS * 2);
  assert.deepEqual(
    Array.from(packed.offsets.slice(0, recipe.layers.length * 2)),
    recipe.layers.flatMap((layer) => [layer.offsetX, layer.offsetY]),
  );
});

test("shader exposes density, edge, and layer offset uniforms", () => {
  assert.match(fragmentShaderSource, /uniform float uDensityScale;/);
  assert.match(fragmentShaderSource, /uniform float uEdgeSharpness;/);
  assert.match(fragmentShaderSource, /uniform vec2 uLayerOffsets\[6\];/);
});

test("both mixed-card renderers upload every advanced uniform", async () => {
  const previewSource = await readFile("app/lab/lab-preview.tsx", "utf8");
  const atlasSource = await readFile("app/render/recipe-atlas.tsx", "utf8");
  for (const source of [previewSource, atlasSource]) {
    assert.match(source, /uniform1f\([^\n]*densityScale/);
    assert.match(source, /uniform1f\([^\n]*edgeSharpness/);
    assert.match(source, /uniform2fv\([^\n]*layerOffsets/);
  }
});
```

**Step 2: Run the tests and confirm failure**

```powershell
node --test tests/lab-core.test.mjs tests/lab-shader.test.mjs
```

Expected: packed fields and shader uniforms are absent.

**Step 3: Extend the packed recipe**

Add these fields to `PackedLabRecipe` and populate them in `packLabRecipe`:

```ts
densityScale: number;
edgeSharpness: number;
offsets: Float32Array;
```

Fill `offsets[index * 2]` and `offsets[index * 2 + 1]` from the corresponding normalized layer.

**Step 4: Update the shader and both upload paths**

Declare:

```glsl
uniform float uDensityScale;
uniform float uEdgeSharpness;
uniform vec2 uLayerOffsets[6];
```

For each layer, add `uLayerOffsets[i]` to the local UV before the existing transform. Multiply the existing spatial frequency by `uDensityScale`. Apply edge shaping to the existing alpha or mask value with a bounded `smoothstep`; do not sharpen the white text region or card border.

In both `app/lab/lab-preview.tsx` and `app/render/recipe-atlas.tsx`, cache the three new uniform locations during program setup and upload values only when a packed recipe changes:

```ts
gl.uniform1f(uniforms.densityScale, packed.densityScale);
gl.uniform1f(uniforms.edgeSharpness, packed.edgeSharpness);
gl.uniform2fv(uniforms.layerOffsets, packed.offsets);
```

Do not add per-frame allocations in either animation loop.

**Step 5: Run tests, build, lint, and commit**

```powershell
node --test tests/lab-core.test.mjs tests/lab-shader.test.mjs
npm test
npm run lint
git add app/lab/lab-core.ts app/lab/lab-shader.ts app/lab/lab-preview.tsx app/render/recipe-atlas.tsx tests/lab-core.test.mjs tests/lab-shader.test.mjs
git commit -m "feat: render advanced card motion controls"
```

---

### Task 4: Encode self-contained embeds and add the embed route

**Files:**

- Create: `app/embed/embed-core.ts`
- Create: `app/embed/embed-card.tsx`
- Create: `app/embed/page.tsx`
- Create: `tests/embed-core.test.mjs`
- Create: `tests/embed-page.test.mjs`
- Modify: `app/lab/lab-preview.tsx`
- Modify: `app/globals.css`

**Step 1: Write failing codec and snippet tests**

```js
import { readFile } from "node:fs/promises";

test("round-trips a normalized recipe through an embed URL token", () => {
  const token = encodeEmbedRecipe(recipe);
  const decoded = decodeEmbedRecipe(token);

  assert.ok(decoded);
  assert.deepEqual(packLabRecipe(decoded), packLabRecipe(recipe));
  assert.deepEqual(decoded.palette, recipe.palette);
  assert.doesNotMatch(token, /[+/=]/);
});

test("builds a fixed-size lazy iframe snippet", () => {
  const html = buildEmbedSnippet(recipe, "https://spectra.8538690.xyz");

  assert.match(html, /^<iframe /);
  assert.match(html, /width="400"/);
  assert.match(html, /height="100"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /title="SPECTRA dynamic card"/);
  assert.match(html, /referrerpolicy="no-referrer"/);
  assert.match(html, /https:\/\/spectra\.8538690\.xyz\/embed\?recipe=/);
});

test("rejects malformed and oversized recipe tokens", () => {
  assert.equal(decodeEmbedRecipe("not-a-recipe"), null);
  assert.equal(decodeEmbedRecipe("a".repeat(8193)), null);
});

test("embed client includes offscreen and reduced-motion guards", async () => {
  const source = await readFile("app/embed/embed-card.tsx", "utf8");
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /visibilitychange/);
  assert.equal((source.match(/<LabPreview\b/g) ?? []).length, 1);
});
```

**Step 2: Run the codec tests and confirm failure**

```powershell
node --test tests/embed-core.test.mjs tests/embed-page.test.mjs
```

Expected: the embed module does not exist.

**Step 3: Implement the URL-safe codec**

In `app/embed/embed-core.ts`, export:

```ts
export const MAX_EMBED_TOKEN_LENGTH = 8192;
export function encodeEmbedRecipe(recipe: LabRecipe): string;
export function decodeEmbedRecipe(token: string): LabRecipe | null;
export function buildEmbedSnippet(recipe: LabRecipe, origin: string): string;
```

Create an `EmbedRecipePayloadV1` with `v: 1` and only renderer inputs: interaction strength, palette colors, layer shader parameters, layer speed profiles, layer offsets, interaction modes, density scale, and edge sharpness. Do not encode showcase id, creation time, source, study name, chapter name, palette label, selected constraint labels, or other UI copy. UTF-8 encode the payload JSON, Base64 encode it, replace `+` with `-`, replace `/` with `_`, and strip trailing `=`. Throw a `RangeError` if the encoded output exceeds `MAX_EMBED_TOKEN_LENGTH`.

Decode with the inverse mapping, validate version and every renderer field with the same numeric/color bounds as `normalizeLabRecipe`, then rehydrate non-rendered `LabRecipe` metadata with deterministic neutral values before calling `normalizeLabRecipe`. Return `null` for every parse, size, version, or validation error. The round-trip contract is identical packed renderer data, not identical nonvisual labels. Normalize `origin` through `new URL(origin).origin` before constructing the snippet.

For a token whose literal value is `encoded-recipe`, the returned snippet must be:

```html
<iframe src="https://spectra.8538690.xyz/embed?recipe=encoded-recipe" title="SPECTRA dynamic card" width="400" height="100" loading="lazy" referrerpolicy="no-referrer" style="border:0;border-radius:54px;overflow:hidden"></iframe>
```

The implementation substitutes the encoded token and normalized origin; it must not interpolate unsanitized attributes.

**Step 4: Build the minimal embed page**

`app/embed/page.tsx` reads `searchParams.recipe`, decodes it, and renders either `EmbedCard` or a compact invalid-link state. Add `export const dynamic = "force-dynamic"` so request-specific query data is never reused.

`app/embed/embed-card.tsx` is a client component that:

- renders only the 400 × 100 card with no site navigation;
- uses `IntersectionObserver` to pass an active flag to `LabPreview`;
- listens to `matchMedia("(prefers-reduced-motion: reduce)")`;
- pauses animation when not intersecting, the document is hidden, or reduced motion is active;
- resumes from the existing phase without recreating the WebGL context.

Extend `LabPreview` with an optional `active?: boolean` prop defaulting to `true`. When false, cancel the scheduled frame and draw one static frame; do not destroy the context.

**Step 5: Run all checks and commit**

```powershell
node --test tests/embed-core.test.mjs tests/embed-page.test.mjs
npm test
npm run lint
git add app/embed app/lab/lab-preview.tsx app/globals.css tests/embed-core.test.mjs tests/embed-page.test.mjs
git commit -m "feat: add self-contained card embeds"
```

---

### Task 5: Implement secure administrator sessions and KV-backed login limiting

**Files:**

- Create: `worker/admin-auth.ts`
- Create: `tests/admin-auth.test.mjs`

**Step 1: Write failing Web Crypto tests**

Use a fixed test secret and fixed `now` value so the tests remain deterministic:

```js
test("creates and verifies a session token", async () => {
  const token = await createSessionToken("test-secret-with-32-bytes-minimum", 1_800_000_000_000);
  const session = await verifySessionToken(
    token,
    "test-secret-with-32-bytes-minimum",
    1_800_000_001_000,
  );

  assert.equal(session?.role, "admin");
});

test("rejects altered and expired session tokens", async () => {
  const token = await createSessionToken("test-secret-with-32-bytes-minimum", 1_800_000_000_000);
  assert.equal(
    await verifySessionToken(`${token}x`, "test-secret-with-32-bytes-minimum", 1_800_000_001_000),
    null,
  );
  assert.equal(
    await verifySessionToken(token, "test-secret-with-32-bytes-minimum", 1_800_086_401_000),
    null,
  );
});

test("compares fixed-length password digests", async () => {
  assert.equal(await verifyPassword("wlh1124", "wlh1124"), true);
  assert.equal(await verifyPassword("wlh1124", "wlh1125"), false);
  assert.equal(await verifyPassword("short", "a much longer value"), false);
});

test("hashes client identifiers and locks the fifth failure for fifteen minutes", async () => {
  const store = createMemoryAttemptStore();
  const key = await createLoginAttemptKey(
    "198.51.100.8",
    "test-secret-with-32-bytes-minimum",
  );

  assert.match(key, /^auth:attempt:[0-9a-f]{64}$/);
  assert.doesNotMatch(key, /198\.51\.100\.8/);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordLoginFailure(store, key, 20_000 + attempt);
  }
  assert.equal(await isLoginAllowed(store, key, 25_000), false);
  assert.equal(await isLoginAllowed(store, key, 920_001), true);
});
```

**Step 2: Run and confirm failure**

```powershell
node --test tests/admin-auth.test.mjs
```

Expected: `worker/admin-auth.ts` does not exist.

**Step 3: Implement the pure authentication module**

Export:

```ts
export const ADMIN_COOKIE_NAME = "__Host-spectra_admin";
export const SESSION_MAX_AGE_MS = 43_200_000;
export function verifyPassword(candidate: string, expected: string): Promise<boolean>;
export async function createSessionToken(secret: string, now?: number): Promise<string>;
export async function verifySessionToken(
  token: string,
  secret: string,
  now?: number,
): Promise<{ role: "admin"; issuedAt: number } | null>;
export function buildSessionCookie(token: string): string;
export function buildLogoutCookie(): string;
export function readCookie(request: Request, name: string): string | null;
export function createLoginAttemptKey(ip: string, secret: string): Promise<string>;
export function isLoginAllowed(
  store: Pick<KVNamespace, "get">,
  key: string,
  now?: number,
): Promise<boolean>;
export function recordLoginFailure(
  store: Pick<KVNamespace, "get" | "put">,
  key: string,
  now?: number,
): Promise<void>;
export function clearLoginFailures(
  store: Pick<KVNamespace, "delete">,
  key: string,
): Promise<void>;
```

Hash both supplied and expected passwords with SHA-256, then compare the two fixed-length digest byte arrays without returning early. Sign the Base64URL session payload with `crypto.subtle` HMAC SHA-256. The payload contains only `role: "admin"`, `issuedAt`, and a cryptographic nonce. Verify signature before parsing trusted fields. Limit sessions to 12 hours even though the browser cookie is session-only. Cookie output must always include `HttpOnly; Secure; SameSite=Strict; Path=/` and must not include `Max-Age` or `Expires`.

Hash `CF-Connecting-IP` with HMAC-SHA-256 before forming the KV key so raw IP addresses are never stored. Store a compact `{ count, firstAt }` JSON value with a 15-minute KV expiration. The fifth failed attempt locks login until the window expires; successful login deletes the attempt key. Treat malformed attempt records as empty rather than throwing.

**Step 4: Run checks and commit**

```powershell
node --test tests/admin-auth.test.mjs
npm test
npm run lint
git add worker/admin-auth.ts tests/admin-auth.test.mjs
git commit -m "feat: secure administrator sessions"
```

---

### Task 6: Add the Worker curation API backed by KV

**Files:**

- Create: `worker/api.ts`
- Modify: `worker/index.ts`
- Modify: `vite.config.ts`
- Create: `tests/worker-api.test.mjs`
- Modify: `tests/rendered-html.test.mjs`

**Step 1: Write failing API tests with an in-memory KV fake**

Cover these requests:

```text
GET    /api/curation        public, returns version-2 shared state
GET    /api/admin/session   public, returns authenticated false or true
POST   /api/admin/login     public, validates password and sets session cookie
POST   /api/admin/logout    public, expires session cookie
POST   /api/showcase        admin only, appends one atomic or mixed recipe
DELETE /api/showcase/:id    admin only, removes one homepage entry
DELETE /api/studies/:id     admin only, records one deleted atomic study
POST   /api/curation/import-local admin only, merges normalized local state
```

Representative assertions:

```js
test("serves public curation and rejects anonymous mutation", async () => {
  const env = createTestEnv();
  const publicResponse = await handleApiRequest(
    new Request("https://spectra.test/api/curation"),
    env,
  );
  assert.equal(publicResponse.status, 200);
  assert.deepEqual((await publicResponse.json()).data.state, {
    version: 2,
    deletedStudyIds: [],
    showcase: [],
  });

  const denied = await handleApiRequest(
    new Request("https://spectra.test/api/showcase", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://spectra.test",
      },
      body: JSON.stringify({ source: "lab", recipe }),
    }),
    env,
  );
  assert.equal(denied.status, 401);
});

test("logs in, writes shared state, and reads it publicly", async () => {
  const env = createTestEnv();
  const login = await handleApiRequest(
    new Request("https://spectra.test/api/admin/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "198.51.100.2",
        origin: "https://spectra.test",
      },
      body: JSON.stringify({ password: "test-password" }),
    }),
    env,
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";", 1)[0];

  const saved = await handleApiRequest(
    new Request("https://spectra.test/api/showcase", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        origin: "https://spectra.test",
      },
      body: JSON.stringify({ source: "lab", recipe }),
    }),
    env,
  );
  assert.equal(saved.status, 200);

  const read = await handleApiRequest(new Request("https://spectra.test/api/curation"), env);
  assert.equal((await read.json()).data.state.showcase.length, 1);
});
```

Also test malformed JSON (`400`), request body over 256 KB (`413`), wrong Origin (`403`), login throttling (`429`), unknown API route (`404`), deleted-study persistence, exact-fingerprint import deduplication, empty KV, and damaged KV. Damaged KV must return the safe empty state plus the stable error code `CURATION_CORRUPT` without writing to KV.

**Step 2: Run the Worker tests and confirm failure**

```powershell
node --test tests/worker-api.test.mjs
```

Expected: the API module does not exist.

**Step 3: Implement the API dispatcher**

Define the Worker environment in `worker/api.ts`:

```ts
export interface SpectraEnv {
  ASSETS: Fetcher;
  IMAGES: {
    input(source: ReadableStream | ArrayBuffer): {
      transform(options: Record<string, unknown>): {
        output(options: Record<string, unknown>): Promise<Response>;
      };
    };
  };
  CURATION_KV: KVNamespace;
  SPECTRA_ADMIN_PASSWORD: string;
  SPECTRA_SESSION_SECRET: string;
}
```

Store the normalized `CurationStateV2` JSON directly under `curation:v2`. Login failure records use the hashed `auth:attempt:<digest>` keys from Task 5 and a 15-minute TTL.

```ts
interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    requestId: string;
  };
}
```

Use this envelope for every JSON response. Chinese messages stay in the frontend so API error codes remain stable. Use `Cache-Control: no-store` for session and mutation responses and `Cache-Control: public, max-age=15, stale-while-revalidate=60` for successful public reads. Include a request id in JSON error responses, but never return secret values or raw exception stacks.

Every write request must first validate a live signed session and then require `request.headers.get("origin") === new URL(request.url).origin`. Normalize all recipes and ids before updating state. `/api/curation/import-local` merges showcase entries by exact `recipeFingerprint`, preserves the server entry when duplicated, and unions deleted-study ids. Do not add revisioning, history, or a lock service: this is a single-admin, low-write KV store and eventual propagation is an accepted constraint.

**Step 4: Route API requests before the Next handler**

At the top of `worker/index.ts` fetch handling:

```ts
const apiResponse = await handleApiRequest(request, env);
if (apiResponse) {
  return apiResponse;
}
```

Return `null` only for paths outside `/api/`. Preserve the existing image optimization and Next handler behavior.

**Step 5: Configure the KV binding for local and production builds**

In `vite.config.ts`, use an environment-provided production namespace id and a deterministic local placeholder:

```ts
const localCurationKvId = "00000000000000000000000000000000";
const curationKvId = process.env.SPECTRA_CURATION_KV_ID ?? localCurationKvId;
```

Add:

```ts
kv_namespaces: [
  {
    binding: "CURATION_KV",
    id: curationKvId,
  },
],
```

to `localBindingConfig`. Keep secrets out of Vite configuration. In `tests/rendered-html.test.mjs`, give the built worker a minimal KV fake so existing rendered-page tests continue to exercise the real entry point.

**Step 6: Run all checks and commit**

```powershell
node --test tests/worker-api.test.mjs tests/rendered-html.test.mjs
npm test
npm run lint
git add worker/api.ts worker/index.ts vite.config.ts tests/worker-api.test.mjs tests/rendered-html.test.mjs
git commit -m "feat: persist shared curation through worker api"
```

---

### Task 7: Replace local-only curation with shared fetch state and admin state

**Files:**

- Create: `app/admin/use-admin.ts`
- Create: `app/admin/admin-panel.tsx`
- Create: `app/curation/curation-api.ts`
- Modify: `app/curation/use-curation.ts`
- Create: `tests/curation-api.test.mjs`
- Modify: `app/globals.css`

**Step 1: Write failing API-client tests**

Test the request shape with a fake `fetch`:

```js
test("sends an authenticated showcase addition", async () => {
  const calls = [];
  const api = createCurationApi(async (input, init) => {
    calls.push([input, init]);
    return Response.json({ ok: true, data: { state } });
  });

  await api.addShowcase("lab", recipe);
  assert.equal(calls[0][0], "/api/showcase");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    source: "lab",
    recipe,
  });
});

test("surfaces stable API error codes", async () => {
  const api = createCurationApi(async () =>
    Response.json(
      { ok: false, error: { code: "SESSION_REQUIRED", requestId: "request-1" } },
      { status: 401 },
    ),
  );

  await assert.rejects(() => api.removeShowcase("entry-1"), (error) => {
    assert.equal(error.name, "CurationApiError");
    assert.equal(error.code, "SESSION_REQUIRED");
    return true;
  });
});
```

**Step 2: Run and confirm failure**

```powershell
node --test tests/curation-api.test.mjs
```

Expected: `createCurationApi` does not exist.

**Step 3: Implement the fetch clients**

`app/curation/curation-api.ts` exports `createCurationApi(fetcher = fetch)` with `read`, `addShowcase`, `removeShowcase`, `deleteStudy`, and `importLocal` methods. Every request uses same-origin credentials. Convert non-success envelopes into `CurationApiError` with a stable `code`; preserve a returned safe state when the Worker reports `CURATION_CORRUPT`.

`app/admin/use-admin.ts` exposes:

```ts
interface AdminController {
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  login(password: string): Promise<boolean>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}
```

It reads `/api/admin/session` on mount. Do not store the password or authentication flag in local storage.

Export the event name `SPECTRA_ADMIN_SESSION_EVENT`. `useAdmin` listens for that window event and refreshes the session. When a curation mutation receives `401`, `useCuration` dispatches the event; this keeps the two small hooks synchronized without adding a global state dependency.

**Step 4: Refactor `useCuration`**

Return:

```ts
interface CurationController {
  state: CurationStateV2;
  loading: boolean;
  saving: boolean;
  error: string | null;
  legacyState: CurationStateV2 | null;
  add(recipe: LabRecipe, source: "library" | "lab"): Promise<void>;
  removeShowcase(id: string): Promise<void>;
  deleteStudy(studyId: number): Promise<void>;
  migrateLegacy(): Promise<void>;
  refresh(): Promise<void>;
}
```

On mount, fetch shared state. Separately inspect the existing local-storage key, normalize it, and expose it as `legacyState` only when it contains showcase entries or deleted-study ids. Never auto-upload it. After a successful administrator migration, remove the old local key and replace the current page state with the normalized state returned by the server.

Do not use permanent optimistic updates. Replace React state with the normalized state returned by every successful write. On `401`, immediately mark the administrator session unauthenticated and show `管理会话已失效，请重新登录。`; on network errors, retain the currently displayed state and offer retry.

**Step 5: Build the administrator panel**

`AdminPanel` is opened by a discreet `管理` button. It contains a password field, login button, login error, logout button, current shared item count, and—only when `legacyState` exists—a button labeled `同步本机策展` with a confirmation step. Implement focus entry, Enter submission, Escape close, and an `aria-live` error region. Closing the dialog does not log out; closing the browser does because the server cookie has no persistent expiry.

**Step 6: Run all checks and commit**

```powershell
node --test tests/curation-api.test.mjs
npm test
npm run lint
git add app/admin app/curation app/globals.css tests/curation-api.test.mjs
git commit -m "feat: connect curation ui to shared admin state"
```

---

### Task 8: Gate management actions and expose homepage/lab embed copy

**Files:**

- Modify: `app/page.tsx`
- Modify: `app/library/page.tsx`
- Modify: `app/lab/page.tsx`
- Modify: `app/render/recipe-atlas.tsx`
- Modify: `app/render/atomic-atlas.tsx`
- Create: `app/embed/copy-embed-button.tsx`
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/site-copy.test.mjs`
- Modify: `app/globals.css`

**Step 1: Write failing page-contract tests**

Add rendered HTML or source-copy assertions for:

- `管理` on the homepage;
- `更多随机约束` in the laboratory;
- labels `混合方式`, `运动节奏`, `空间构图`, `纹理密度`, `边缘质感`;
- `复制 HTML` on homepage cards and the lab result;
- no public `删除效果` or `加入首页` action before authentication state resolves.

Run:

```powershell
node --test tests/rendered-html.test.mjs tests/site-copy.test.mjs
```

Expected: new labels and action contracts are missing.

**Step 2: Add the public copy component**

`CopyEmbedButton` receives a normalized recipe, calls `buildEmbedSnippet(recipe, window.location.origin)`, writes it with `navigator.clipboard.writeText`, and changes its label from `复制 HTML` to `已复制` for 1.5 seconds. If the Clipboard API is unavailable or denied, display a selected read-only textarea containing the snippet and the message `请手动复制代码`. If encoding exceeds 8 KB, show `配方过大，请减少效果数量后重试`. Do not use a blocking alert.

**Step 3: Gate every mutation by server-confirmed admin state**

On the homepage:

- always show the curated cards and `复制 HTML`;
- show `管理` to everyone;
- show remove controls, configuration export, and migration only when `authenticated === true`;
- wire all mutation buttons to async `useCuration` methods and disable them while saving.

On `/library`:

- always show all non-deleted single effects with random, pause, reset, and pagination controls;
- show `加入首页` and `删除效果` only in authenticated management mode;
- `删除效果` writes the study id into shared `deletedStudyIds`, removes that atomic effect from the library and future lab selection for every visitor, and leaves already-saved showcase recipes and embeds intact.

On `/lab`:

- always allow random generation and `复制 HTML`;
- show `加入首页` only for authenticated administrators.

Even though the UI gates controls, rely on Worker authorization as the real protection.

**Step 4: Add the advanced random controls**

Keep the existing effect-count control always visible. Put all new controls inside:

```tsx
<details className="lab-advanced-controls">
  <summary>更多随机约束</summary>
  {/* Five labeled select controls */}
</details>
```

Use these Chinese options:

```text
混合方式: 随机 / 自由混合 / 融合 / 撞击 / 交缠 / 侵蚀 / 光叠加 / 差异碰撞
运动节奏: 随机 / 游走 / 呼吸 / 忽快忽慢 / 脉冲 / 连续流动
空间构图: 随机 / 自动 / 横向推进 / 中心撞击 / 两侧夹流 / 漩涡 / 交错穿插
纹理密度: 随机 / 稀薄 / 标准 / 浓密
边缘质感: 随机 / 柔雾 / 混合 / 清晰
```

Default all five UI selections to `随机`. Existing speed minimum and maximum remain visible and constrain every rhythm.

Extend the current recipe summary to show the five resolved values, not the literal `随机` selections. This confirms what will be saved and guarantees the summary matches the copied embed.

**Step 5: Run all checks and commit**

```powershell
node --test tests/rendered-html.test.mjs tests/site-copy.test.mjs
npm test
npm run lint
git add app/page.tsx app/library/page.tsx app/lab/page.tsx app/render/recipe-atlas.tsx app/render/atomic-atlas.tsx app/embed/copy-embed-button.tsx app/globals.css tests/rendered-html.test.mjs tests/site-copy.test.mjs
git commit -m "feat: add managed curation and embed actions"
```

---

### Task 9: Document administration, embedding, and Cloudflare configuration

**Files:**

- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `package.json`
- Create: `.dev.vars.example`
- Modify: `tests/site-copy.test.mjs`

**Step 1: Write failing documentation assertions**

Assert that README source contains:

```text
管理模式
Cloudflare KV
SPECTRA_ADMIN_PASSWORD
SPECTRA_SESSION_SECRET
复制 HTML
/embed?recipe=
```

Also assert `.gitignore` contains `.dev.vars` and `.dev.vars.*` while retaining `!.dev.vars.example`.

**Step 2: Run and confirm failure**

```powershell
node --test tests/site-copy.test.mjs
```

Expected: deployment and management documentation is absent.

**Step 3: Add safe local configuration documentation**

Create `.dev.vars.example` with names only and explicit non-production examples:

```dotenv
SPECTRA_ADMIN_PASSWORD=change-this-local-password
SPECTRA_SESSION_SECRET=replace-with-at-least-32-random-characters
```

Document that `.dev.vars` is ignored, the real administrator password is set with `wrangler secret put`, and the session secret must be randomly generated. Explain local migration, shared homepage behavior, session-only login, all five random groups, and iframe copy usage in Chinese.

Add a script that makes the production KV id requirement explicit:

```json
"build:cloudflare": "node -e \"if(!process.env.SPECTRA_CURATION_KV_ID)throw new Error('SPECTRA_CURATION_KV_ID is required')\" && vite build"
```

Keep the current `build` script unchanged for local development and tests.

**Step 4: Run all checks and commit**

```powershell
node --test tests/site-copy.test.mjs
npm test
npm run lint
git add README.md .gitignore package.json .dev.vars.example tests/site-copy.test.mjs
git commit -m "docs: explain managed curation and embeds"
```

---

### Task 10: Verify locally, provision Cloudflare KV, and deploy

**Files:**

- Modify only if current Cloudflare tooling requires a documented config adjustment discovered during verification: `vite.config.ts`
- Modify only if user-facing deployment facts change: `README.md`

**Step 1: Load the deployment instructions before invoking Wrangler**

Use the `cloudflare:wrangler`, `cloudflare:workers-best-practices`, and `cloudflare:cloudflare` skills. Confirm the installed Wrangler version and current KV namespace command syntax from Cloudflare documentation before running a state-changing command.

**Step 2: Run the complete local verification**

```powershell
npm test
npm run lint
npm run build
```

Expected: every test passes, lint exits 0, and the application build completes.

Start the local Worker-compatible development server with `.dev.vars` present outside Git, then verify with the in-app browser:

```text
http://localhost:3000/
http://localhost:3000/library
http://localhost:3000/lab
Open the `/embed?recipe=` URL produced by the running app's `复制 HTML` action.
```

Manual acceptance checklist:

- anonymous visitors cannot see or execute add/remove/delete controls;
- incorrect login shows a neutral error and repeated failures throttle;
- correct login survives navigation but not a new browser session;
- a logged-in administrator can add one atomic effect and one mixed recipe;
- a second anonymous browser sees the same homepage after refresh;
- a wrong-Origin write returns `403`, an expired session returns `401`, and the UI exits management mode;
- deleting an atomic study hides it from both the shared library and future lab random choices for a new visitor;
- all five random groups visibly affect output while honoring speed bounds;
- copied HTML renders the exact same 400 × 100 card in a blank local HTML page;
- removing the source card does not break the copied embed;
- the embed pauses offscreen and under reduced motion;
- desktop, 390 px mobile layout, keyboard login, and Escape-close behavior remain usable;
- no page introduces a second WebGL context per visible card collection.

**Step 3: Create or locate the production KV namespace**

List namespaces first and reuse the namespace titled `spectra-flux-curation` if it exists. Otherwise create exactly one namespace with that title. Capture its returned 32-character id in the current PowerShell session as `SPECTRA_CURATION_KV_ID`; do not commit it as a secret, though the id itself is not confidential.

**Step 4: Set Worker secrets without exposing their values**

Build once with the captured namespace id:

```powershell
npm run build:cloudflare
```

Use interactive Wrangler prompts against `dist/server/wrangler.json` to set:

```text
SPECTRA_ADMIN_PASSWORD
SPECTRA_SESSION_SECRET
```

Enter the user-selected administrator password at the prompt. Generate the session secret with at least 32 random bytes and do not print it into command output, source files, shell history, or the final response.

**Step 5: Deploy to the existing custom domain**

Deploy the generated Worker configuration under the existing Worker name `spectra-flux` and custom domain `spectra.8538690.xyz`. After Wrangler reports success, verify:

```text
https://spectra.8538690.xyz/
https://spectra.8538690.xyz/library
https://spectra.8538690.xyz/lab
https://spectra.8538690.xyz/api/curation
```

Confirm `/api/curation` returns JSON and the other routes render successfully. Repeat the administrator, shared-state, and copied-embed acceptance checks against production.

**Step 6: Run the final repository checks**

```powershell
git status --short
npm test
npm run lint
```

Expected: no uncommitted source changes, all tests pass, and lint exits 0. If Cloudflare-required code or README adjustments were necessary, test them and commit them before this check with:

```powershell
git add vite.config.ts README.md
git commit -m "chore: finalize cloudflare curation deployment"
```

Do not create an empty commit when no deployment adjustment was needed.

---

## Final Acceptance Criteria

- The homepage is shared across visitors and backed by Cloudflare KV.
- The password exists only as `SPECTRA_ADMIN_PASSWORD` in Worker secrets.
- The administrator session uses an `HttpOnly` session cookie and is rate limited.
- Only authenticated administrators can add homepage works, remove showcase entries, delete atomic studies, export shared configuration, or migrate old local data.
- Public users can copy a stable 400 × 100 iframe for any homepage card or lab result.
- Existing embeds remain valid after curated items are removed.
- The laboratory offers deterministic, seed-compatible constraints for mixing, rhythm, composition, density, and edge quality.
- Version-1 local data remains importable and is never uploaded without a confirmed administrator action.
- WebGL animation remains smooth, pauses when offscreen, and respects reduced-motion preferences.
- Automated tests, production build, lint, local browser checks, and deployed-domain checks all pass.
