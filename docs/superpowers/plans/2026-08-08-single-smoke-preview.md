# Single Smoke Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the six-canvas gallery with one 400 × 100 px smoke card and six numbered style controls while retaining independent random configurations.

**Architecture:** Keep the six `CardConfig` values in React state but render only `cards[activeIndex]`. Style buttons update `activeIndex` and the keyed `WebGLPreview` remount guarantees the previous WebGL context and animation loop are disposed. CSS fixes the single preview at 4:1 with a 35:65 copy-to-color split.

**Tech Stack:** React, TypeScript, WebGL2, CSS, Node test runner, Vinext.

## Global Constraints

- Preview size is exactly 400 × 100 px and 4:1.
- Copy occupies 35% and smoke occupies 65%.
- The DOM contains exactly one `.preview-card` and one canvas.
- Styles `01` through `06` remain selectable and preserve their in-memory configs.
- Randomization refreshes all six configs but renders only the active style.
- Remove export, copy HTML, size editing, and shared settings from the page.
- Do not change the fragment shader and do not add dependencies.

---

### Task 1: Change the default card size

**Files:**
- Modify: `app/card-core.ts`
- Test: `tests/card-core.test.mjs`

**Interfaces:**
- Updates: `DEFAULT_CARD_WIDTH = 400`
- Updates: `DEFAULT_CARD_HEIGHT = 100`

- [ ] **Step 1: Write the failing test**

```js
test("the default preview card is 400 by 100", () => {
  assert.equal(DEFAULT_CARD_WIDTH, 400);
  assert.equal(DEFAULT_CARD_HEIGHT, 100);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `node --test tests/card-core.test.mjs`

Expected: FAIL because the values are still 800 and 300.

- [ ] **Step 3: Change the two constants**

```ts
export const DEFAULT_CARD_WIDTH = 400;
export const DEFAULT_CARD_HEIGHT = 100;
```

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `node --test tests/card-core.test.mjs`

Expected: all core tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/card-core.ts tests/card-core.test.mjs
git commit -m "feat: use compact smoke preview dimensions"
```

---

### Task 2: Render one selected smoke card

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: `makeCards(seed): CardConfig[]`
- Produces: `activeIndex` state in the range 0–5
- Produces: six buttons with class `style-tab` and accessible names `查看 01 柔雾扩散` through `查看 06 深景云雾`

- [ ] **Step 1: Write the failing server-render test**

```js
assert.equal((html.match(/class="preview-card"/g) || []).length, 1);
assert.equal((html.match(/<canvas/g) || []).length, 1);
assert.equal((html.match(/class="style-tab/g) || []).length, 6);
assert.match(html, /查看 01 柔雾扩散/);
assert.match(html, /查看 06 深景云雾/);
assert.match(html, /--card-width:400px/);
assert.match(html, /--card-height:100px/);
assert.doesNotMatch(html, /复制此样式|六张共享设置|手动复制 HTML/);
```

- [ ] **Step 2: Build and confirm RED**

Run: `$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'; npm run build; node --test tests/rendered-html.test.mjs`

Expected: FAIL because six cards and six canvases are rendered.

- [ ] **Step 3: Replace the gallery with one selected card**

Keep `cards` and add:

```ts
const [activeIndex, setActiveIndex] = useState(0);
const activeCard = cards[activeIndex];
```

Render one card and key the preview by style:

```tsx
<article className="preview-card" style={cardStyle}>
  <div className="card-copy">...</div>
  <div className="card-visual">
    <WebGLPreview key={activeCard.variant} config={activeCard} playing={playing} />
  </div>
</article>
```

Render the selectors:

```tsx
<nav className="style-tabs" aria-label="选择烟雾样式">
  {variantNames.map((name, index) => (
    <button
      className={`style-tab${activeIndex === index ? " is-active" : ""}`}
      aria-label={`查看 ${String(index + 1).padStart(2, "0")} ${name}`}
      aria-pressed={activeIndex === index}
      onClick={() => setActiveIndex(index)}
      key={name}
    >
      {String(index + 1).padStart(2, "0")}
    </button>
  ))}
</nav>
```

Keep random, pause/play, and reset. Delete per-card copy, fallback textarea, and the shared settings `<details>`.

- [ ] **Step 4: Replace gallery CSS with compact single-preview CSS**

```css
.single-preview { display:grid; justify-items:center; gap:18px; }
.preview-card { width:min(100%,400px); aspect-ratio:4/1; grid-template-columns:35% 65%; }
.style-tabs { display:flex; gap:7px; }
.style-tab { width:34px; height:34px; border-radius:50%; }
.style-tab.is-active { background:#191a1e; color:#fff; }
```

Remove `.card-gallery`, `.gallery-item`, `.gallery-meta`, and `.copy-style`. Tighten copy typography for the 140 px column without changing the shader or visual column.

- [ ] **Step 5: Run the full suite and confirm GREEN**

Run: `$env:npm_config_script_shell='C:\Program Files\Git\bin\bash.exe'; npm test`

Expected: production build succeeds and all tests pass.

- [ ] **Step 6: Verify locally**

At `http://localhost:3000/`, confirm one card, one canvas, 400 × 100 dimensions, 35:65 columns, six working style buttons, unique seeds after randomization, animation pause/resume, and no WebGL or console errors.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: render one selectable smoke preview"
```
