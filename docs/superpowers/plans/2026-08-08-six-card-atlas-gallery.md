# Six-Card Atlas Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single selectable preview with six simultaneously animated 400×100 cards in a two-column gallery, using a 25% copy / 75% visual split and one shared WebGL2 context.

**Architecture:** Extend the fragment shader with an atlas viewport origin, then replace `WebGLPreview` with one `AtlasGallery` component. `AtlasGallery` renders all six DOM cards, draws their variants into a detached 2×3 WebGL source atlas, and copies each atlas cell into its matching visible 2D canvas every frame. CSS supplies the two-column layout, responsive single-column fallback, clipping, and existing card hover behavior.

**Tech Stack:** React 19, TypeScript, WebGL2/GLSL ES 3.00, Canvas 2D, CSS, Node test runner, vinext/Vite

## Global Constraints

- Render six cards in source order 01–06, two columns by three rows on desktop and one column on narrow screens.
- Keep every card exactly 400×100 at full desktop width.
- Change card columns from 35% / 65% to 25% / 75%.
- Keep only `SPECTRA` and `COLOR AS A LIVING SYSTEM.` inside each card.
- Keep one WebGL2 context, one shader program, one animation loop, six WebGL draw calls, and six 2D presentation blits per frame.
- Preserve all six presets, three ink-flow families, `SMOKE_TIME_SCALE = 8`, randomize-all, reset-all, pause/play, whole-card hover, hidden-document skipping, and reduced-motion pause.
- Do not add dependencies, framebuffer feedback, textures, workers, per-card controls, style tabs, renderer badges, export, or deployment.
- WebGL failure must leave the existing CSS gradients visible without adding error text inside cards.

---

## File structure

- Modify `app/card-core.ts`: add viewport-local fragment coordinates while keeping all public card and embed APIs unchanged.
- Modify `app/page.tsx`: replace the one-card WebGL component and active-tab state with the six-card shared atlas renderer.
- Modify `app/globals.css`: add the two-column gallery, change the card split, simplify card copy, and delete obsolete single-preview/tab/badge styles.
- Modify `tests/card-core.test.mjs`: lock atlas-local shader coordinates without changing existing ink-family tests.
- Modify `tests/rendered-html.test.mjs`: lock the six-card DOM, one-context source architecture, copy-only card text, 25/75 split, responsive grid, and existing hover behavior.
- No new runtime or test files are required.

### Task 1: Make the fragment shader atlas-aware

**Files:**
- Modify: `tests/card-core.test.mjs:122-132`
- Modify: `app/card-core.ts:25-70`

**Interfaces:**
- Consumes: existing `resolution` uniform and `gl_FragCoord`.
- Produces: new `uniform vec2 viewportOrigin`; `buildEmbed` remains compatible because an unset WebGL uniform defaults to `(0, 0)`.

- [ ] **Step 1: Write the failing atlas-coordinate test**

Append this test to `tests/card-core.test.mjs`:

```js
test("the fragment shader can render viewport-local atlas cells", () => {
  assert.match(FRAGMENT_SHADER, /uniform vec2 viewportOrigin;/);
  assert.match(
    FRAGMENT_SHADER,
    /vec2 localFragCoord\s*=\s*gl_FragCoord\.xy - viewportOrigin;/,
  );
  assert.match(FRAGMENT_SHADER, /vec2 uv\s*=\s*localFragCoord \/ resolution\.xy;/);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

```powershell
node --test tests/card-core.test.mjs
```

Expected: the new test FAILs because `viewportOrigin` and `localFragCoord` are absent; the existing ten tests PASS.

- [ ] **Step 3: Add atlas-local coordinates to the shader**

Add this uniform immediately after `uniform vec2 resolution;`:

```glsl
uniform vec2 viewportOrigin;
```

Replace the first UV line inside `main`:

```glsl
  vec2 uv = gl_FragCoord.xy / resolution.xy;
```

with:

```glsl
  vec2 localFragCoord = gl_FragCoord.xy - viewportOrigin;
  vec2 uv = localFragCoord / resolution.xy;
```

- [ ] **Step 4: Run the core tests and build**

```powershell
node --test tests/card-core.test.mjs
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
```

Expected: eleven core tests PASS and the build exits `0`.

- [ ] **Step 5: Commit the shader change**

```powershell
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: support atlas shader viewports"
```

### Task 2: Render six cards from one WebGL atlas

**Files:**
- Modify: `tests/rendered-html.test.mjs:26-64`
- Modify: `app/page.tsx:1-308`

**Interfaces:**
- Consumes: `configs: CardConfig[]`, `playing: boolean`, `FRAGMENT_SHADER`, `VERTEX_SHADER`, `SMOKE_TIME_SCALE`, `hexToRgb`, and `toShaderSeed`.
- Produces: `AtlasGallery({ configs, playing })`; six visible 2D canvases backed by one detached WebGL2 source canvas.

- [ ] **Step 1: Write failing six-card and single-context tests**

In the existing server-render test, replace the assertions for one card, one canvas, and six style tabs with:

```js
  assert.equal((html.match(/class="preview-card"/g) || []).length, 6);
  assert.equal((html.match(/class="card-copy"/g) || []).length, 6);
  assert.equal((html.match(/<canvas/g) || []).length, 6);
  assert.equal((html.match(/--card-width:400px/g) || []).length, 6);
  assert.equal((html.match(/--card-height:100px/g) || []).length, 6);
  assert.doesNotMatch(
    html,
    /class="(?:card-label|card-index|render-label|webgl-error|style-heading|style-tab)/,
  );
```

Remove the two assertions that look for style 01 and style 06 tab labels. Append this source test:

```js
test("the gallery shares one WebGL atlas across six 2D canvases", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.equal((source.match(/getContext\("webgl2"/g) || []).length, 1);
  assert.match(source, /document\.createElement\("canvas"\)/);
  assert.match(source, /getContext\("2d"\)/);
  assert.match(source, /configs\.forEach\(\(config, index\)/);
  assert.match(source, /gl\.viewport\(atlasX, atlasY, tileWidth, tileHeight\)/);
  assert.match(source, /context\?\.drawImage\(/);
  assert.doesNotMatch(source, /function WebGLPreview|activeIndex|style-tabs/);
});
```

- [ ] **Step 2: Build and run the rendered test to verify failure**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: FAIL because the rendered page still contains one card, one WebGL canvas, active-index logic, and style tabs.

- [ ] **Step 3: Replace the preview component with the atlas renderer**

In `app/page.tsx`, replace `PreviewProps` and the complete `WebGLPreview` function with the following component:

```tsx
type GalleryProps = {
  configs: CardConfig[];
  playing: boolean;
};

const ATLAS_COLUMNS = 2;
const ATLAS_ROWS = 3;

function AtlasGallery({ configs, playing }: GalleryProps) {
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const paramsRef = useRef(configs);
  const drawRef = useRef<((time: number) => void) | null>(null);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    paramsRef.current = configs;
    drawRef.current?.(lastTimeRef.current);
  }, [configs]);

  useEffect(() => {
    const targets = canvasRefs.current.filter(
      (canvas): canvas is HTMLCanvasElement => Boolean(canvas),
    );
    if (targets.length !== configs.length) return;

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
        colorA: gl.getUniformLocation(program, "colorA"),
        colorB: gl.getUniformLocation(program, "colorB"),
      };

      let tileWidth = 1;
      let tileHeight = 1;

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
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        tileWidth = Math.max(1, Math.round(box.width * ratio));
        tileHeight = Math.max(1, Math.round(box.height * ratio));
        source.width = tileWidth * ATLAS_COLUMNS;
        source.height = tileHeight * ATLAS_ROWS;
        targets.forEach((target) => {
          target.width = tileWidth;
          target.height = tileHeight;
        });
        drawRef.current?.(lastTimeRef.current);
      };

      const observer = new ResizeObserver(resize);
      targets.forEach((target) => observer.observe(target));
      resize();

      return () => {
        observer.disconnect();
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        gl.deleteBuffer(buffer);
        drawRef.current = null;
      };
    } catch (error) {
      console.warn("Luma atlas WebGL fallback", error);
    }
  }, []);

  useEffect(() => {
    let frame = 0;
    const draw = (now: number) => {
      if (!document.hidden) drawRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    if (playing) frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return (
    <div className="atlas-gallery">
      {configs.map((config, index) => {
        const cardStyle = {
          "--card-a": config.colorA,
          "--card-b": config.colorB,
          "--card-radius": `${config.radius}px`,
          "--card-width": `${config.width}px`,
          "--card-height": `${config.height}px`,
        } as CSSProperties;

        return (
          <article
            className="preview-card"
            style={cardStyle}
            aria-label={`SPECTRA ${String(index + 1).padStart(2, "0")}`}
            key={config.variant}
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
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Remove active-card state and render the gallery**

Inside `Home`, delete `activeIndex`, `activeCard`, and the single `cardStyle`. Change the initial notice to:

```tsx
  const [notice, setNotice] = useState("六款墨流同时展示");
```

In reset, remove `setActiveIndex(0)` and use:

```tsx
              setCards(makeCards(20260807));
              setNotice("已恢复六款默认墨流");
```

Replace the complete `.single-preview` block, including style heading and tabs, with:

```tsx
        <AtlasGallery configs={cards} playing={playing} />
```

Update visible page copy to match the gallery:

```tsx
          <h1>六张卡片，<br />六种墨流。</h1>
```

```tsx
        <p>
          六张卡片由一个 WebGL 图集同步驱动。每次随机都会更新六套配色、种子与流动结构，
          同时保持页面轻量流畅。
        </p>
```

Update the workspace label and footer:

```tsx
      <section className="workspace" aria-label="六张动态墨流卡片">
```

```tsx
        <span>ONE WEBGL CONTEXT · SIX INK STUDIES</span>
        <span>400 × 100 · COLOR AREA 75%</span>
```

- [ ] **Step 5: Build and run rendered/source tests**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: the source architecture and server-render tests PASS, reporting six cards and six visible canvases.

- [ ] **Step 6: Commit the shared renderer**

```powershell
git add app/page.tsx tests/rendered-html.test.mjs
git commit -m "feat: render six cards from one WebGL atlas"
```

### Task 3: Apply the 25/75 two-column gallery layout

**Files:**
- Modify: `tests/rendered-html.test.mjs:66-86`
- Modify: `app/globals.css:85-350`

**Interfaces:**
- Consumes: `.atlas-gallery`, `.preview-card`, `.card-copy`, `.card-visual`, and the existing hover media query.
- Produces: two 400px columns on desktop, one column below 900px, and a 25% / 75% card split.

- [ ] **Step 1: Write the failing gallery-layout test**

Append this test to `tests/rendered-html.test.mjs`:

```js
test("the gallery uses two columns and a 25 to 75 card split", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.atlas-gallery\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 400px\)\)/s,
  );
  assert.match(
    css,
    /\.preview-card\s*\{[^}]*grid-template-columns:\s*25% 75%/s,
  );
  assert.match(
    css,
    /@media \(max-width: 900px\)[\s\S]*\.atlas-gallery\s*\{[^}]*grid-template-columns:\s*minmax\(0, 400px\)/,
  );
});
```

- [ ] **Step 2: Run the stylesheet test and verify failure**

```powershell
node --test tests/rendered-html.test.mjs
```

Expected: the new layout test FAILs because `.atlas-gallery` and `25% 75%` are absent.

- [ ] **Step 3: Replace single-preview styles with the gallery grid**

Delete `.single-preview`, `.style-heading`, `.style-heading b`, and `.style-heading span`. Add:

```css
.atlas-gallery {
  width: min(100%, 848px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 400px));
  justify-content: center;
  gap: 28px 48px;
}
```

In `.preview-card`, replace the grid columns with:

```css
  grid-template-columns: 25% 75%;
```

- [ ] **Step 4: Simplify copy and delete obsolete card UI styles**

Remove `.card-label`, `.card-index`, `.card-index b`, `.render-label`, `.webgl-error`, `.style-tabs`, `.style-tab`, `.style-tab:hover`, and `.style-tab.is-active` rules and remove those selectors from shared font rules.

Use these copy rules:

```css
.card-copy {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 12px 10px;
  background: #fff;
}

.card-copy h2 {
  margin: 0 0 5px;
  overflow-wrap: anywhere;
  font-size: 17px;
  line-height: .9;
  letter-spacing: -.07em;
}

.card-copy > p {
  margin: 0;
  font-size: 5px;
  line-height: 1.3;
  letter-spacing: -.01em;
}
```

- [ ] **Step 5: Add the single-column breakpoint**

Inside the existing `@media (max-width: 900px)` block, add:

```css
  .atlas-gallery { grid-template-columns: minmax(0, 400px); }
```

Inside `@media (max-width: 760px)`, update the card override to:

```css
  .preview-card { grid-template-columns: 25% 75%; min-height: 0; }
```

- [ ] **Step 6: Run the complete build and tests**

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
```

Expected: build exits `0`; all core, server-render, source-architecture, layout, and hover tests PASS.

- [ ] **Step 7: Commit the gallery layout**

```powershell
git add app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: lay out six compact ink cards"
```

### Task 4: Browser performance and interaction verification

**Files:**
- Verify: `app/card-core.ts`
- Verify: `app/page.tsx`
- Verify: `app/globals.css`
- Verify: `tests/card-core.test.mjs`
- Verify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: the completed shared atlas gallery.
- Produces: evidence that six cards animate distinctly and remain responsive with one WebGL context.

- [ ] **Step 1: Run static verification from the feature worktree**

```powershell
git diff --check
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git status --short
```

Expected: build and every test PASS; status has no uncommitted implementation changes.

- [ ] **Step 2: Verify desktop structure in the local browser**

Open `http://localhost:3000/` at a desktop viewport and confirm:

- six `.preview-card` elements form two columns and three rows;
- each card measures 400×100;
- each computed grid split is approximately 100px / 300px;
- six visible canvases exist, but the page source creates `webgl2` only once;
- no style tabs, seed rows, labels, or renderer badges appear.

- [ ] **Step 3: Verify simultaneous distinct motion**

Capture all six visible canvas frame hashes, wait at least 1.2 seconds, and capture them again. Expected: all six are visually distinct and every card's frame changes. Observe for at least three seconds and confirm none snaps back after 1–2 seconds.

- [ ] **Step 4: Verify shared controls**

Pause and compare two screenshots at least 800ms apart; they must match. Resume and confirm all six change again. Randomize twice and confirm all six seeds/colors change while every card remains 400×100 and the two text strings remain unchanged. Reset and confirm deterministic defaults return.

- [ ] **Step 5: Verify hover and fallback-visible structure**

Hover one card and confirm only that card rises and gains shadow while neighboring cards retain their positions. Confirm every `.card-visual` retains a CSS gradient beneath its canvas so a missing WebGL context would still leave six colored cards.

- [ ] **Step 6: Verify responsive layout**

At a viewport narrower than 900px, confirm the gallery becomes one column without changing each card's 25% / 75% split. Restore the desktop viewport and confirm two columns return.

- [ ] **Step 7: Report evidence**

Report the exact test count, build result, card/canvas count, computed split, frame-change result, pause/resume result, random/reset result, hover isolation, responsive columns, and any remaining pre-existing lint issue separately from this feature.
