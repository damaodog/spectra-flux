# Card Sequence and Name Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a visible `01–06` sequence number and the existing Chinese variant name on each of the six smoke cards.

**Architecture:** Reuse the existing `variantNames` array and render one static `card-meta` span inside each card’s left copy area. Style the span with native CSS absolute positioning so the WebGL atlas, card sizing, layout, and animation loop remain untouched.

**Tech Stack:** React, TypeScript, CSS, Node.js built-in test runner, vinext.

## Global Constraints

- Keep every card at exactly 400 × 100 px with the existing 25% / 75% copy-to-visual split.
- Keep all six cards driven by the existing single WebGL atlas and animation loop.
- Add no dependencies, state, configuration objects, or new data structures.
- Preserve `SPECTRA` and `COLOR AS A LIVING SYSTEM.` below the new metadata line.
- Use the existing names in this exact order: 柔雾扩散、彩墨叠层、横向薄纱、墨滴晕染、斜向漂移、深景云雾。

---

### Task 1: Render and style sequence-name labels

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `variantNames[index]` and the existing zero-based card `index` from `AtlasGallery`.
- Produces: six visible `.card-meta` spans containing `01 · 柔雾扩散` through `06 · 深景云雾`.

- [ ] **Step 1: Write the failing rendered-HTML test**

Add these assertions inside `server-renders the WebGL card generator` after the existing six-card count assertions:

```js
assert.equal((html.match(/class="card-meta"/g) || []).length, 6);
const cardMeta = [
  "01 · 柔雾扩散",
  "02 · 彩墨叠层",
  "03 · 横向薄纱",
  "04 · 墨滴晕染",
  "05 · 斜向漂移",
  "06 · 深景云雾",
];
cardMeta.forEach((label) => assert.match(html, new RegExp(label)));
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: the rendered-HTML test fails because the page contains zero `card-meta` elements instead of six.

- [ ] **Step 3: Render the minimal metadata span**

In `app/page.tsx`, add the span as the first child of `.card-copy`:

```tsx
<span className="card-meta">
  {`${String(index + 1).padStart(2, "0")} · ${variantNames[index]}`}
</span>
```

- [ ] **Step 4: Style the metadata without changing layout**

In `app/globals.css`, add this rule after `.card-copy`:

```css
.card-meta {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  overflow: hidden;
  color: #92949b;
  font: 650 6px/1 ui-monospace, "SFMono-Regular", Consolas, monospace;
  letter-spacing: .06em;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/rendered-html.test.mjs
```

Expected: all rendered-HTML tests pass, including all six exact sequence-name labels.

- [ ] **Step 6: Run the complete automated verification**

Run:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
npx vinext build
node --test tests/card-core.test.mjs tests/rendered-html.test.mjs
git diff --check
```

Expected: build exits 0, all 15 tests pass, and `git diff --check` reports no errors.

- [ ] **Step 7: Verify the local page**

At `http://localhost:3000/`, verify:

- all six cards show the exact `01–06` and name pairs;
- the label stays inside the left white copy area without overlapping `SPECTRA`;
- cards remain 400 × 100 px with a 25% / 75% split;
- animation, all-random, pause, reset, and whole-card hover still work;
- the browser console contains no WebGL warnings or errors.

- [ ] **Step 8: Commit the implementation**

```powershell
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: show card sequence names"
```
