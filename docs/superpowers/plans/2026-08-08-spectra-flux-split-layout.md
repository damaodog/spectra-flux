# SPECTRA FLUX Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the local WebGL gallery to SPECTRA FLUX and reorganize it into a sticky 320px control rail beside the existing two-column motion gallery.

**Architecture:** Keep the existing React state, atlas renderer, catalog, and card components unchanged. Recompose only the `Home` markup into a semantic `control-rail` plus `gallery-panel`, then express desktop and responsive layout entirely in the existing stylesheet.

**Tech Stack:** React 19, TypeScript, CSS Grid, vinext, Node test runner, ESLint

## Global Constraints

- Visible English brand is exactly `SPECTRA FLUX`; Chinese meaning is `光谱流域`.
- Browser title is exactly `SPECTRA FLUX — Generative Motion Atlas`.
- Desktop control rail is approximately `320px` and sticky while the gallery scrolls.
- The right gallery remains two columns with twelve `400 × 100` cards per page.
- Preserve all 36 WebGL studies, the shared atlas, randomize, pause/play, reset, pagination, 75% visual area, and hover behavior.
- Preserve the current cream, black, pixel-pattern, fine-line, pill-button, rounded-card visual language.
- Add no dependencies and no new React state.
- Medium screens stack the rail above the gallery; screens below `900px` use one card column.

---

### Task 1: Brand and Semantic Page Composition

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: the existing `playing`, `notice`, `pageIndex`, `visibleCards`, `randomizeAll`, `setCards`, and `setPageIndex` state and handlers in `Home`.
- Produces: `.studio-shell`, `.control-rail`, `.control-rail-inner`, and `.gallery-panel` hooks for Task 2 CSS.

- [ ] **Step 1: Write the failing brand and structure assertions**

Update the first rendered HTML test to expect the new title and brand, then add structural assertions:

```js
assert.match(html, /<title>SPECTRA FLUX — Generative Motion Atlas<\/title>/i);
assert.match(html, />SPECTRA FLUX<\/a>/);
assert.match(html, /class="studio-shell"/);
assert.match(html, /class="control-rail"/);
assert.match(html, /class="control-rail-inner"/);
assert.match(html, /class="gallery-panel workspace"/);
assert.doesNotMatch(html, />LUMA LAB<\/a>/);
```

- [ ] **Step 2: Run the rendered test and verify RED**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: the first test fails because the HTML still contains the LUMA LAB title and lacks the split-layout class hooks.

- [ ] **Step 3: Update metadata and recompose `Home`**

In `app/layout.tsx`, set:

```ts
export const metadata: Metadata = {
  title: "SPECTRA FLUX — Generative Motion Atlas",
  description: "SPECTRA FLUX 光谱流域：三十六种 WebGL 色彩动态实验。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};
```

In `app/page.tsx`, preserve every existing handler and render the current controls inside this hierarchy:

```tsx
<main className="studio" id="top">
  <div className="studio-shell">
    <aside className="control-rail">
      <div className="control-rail-inner">
        <header className="studio-header">
          <a className="brand" href="#top" aria-label="SPECTRA FLUX 首页">
            SPECTRA FLUX
          </a>
          <div className="header-meta">
            <span>WEBGL MOTION ATLAS</span>
            <span className="live-dot" aria-hidden="true" />
            <span>{playing ? "LIVE" : "PAUSED"}</span>
          </div>
        </header>

        <section className="intro">
          <span className="eyebrow">THIRTY-SIX GENERATIVE MOTION STUDIES / 2026</span>
          <h1>三十六张卡片，<br />三十六种动态。</h1>
          <p>三页分别探索雾与薄纱、光学材质和流体力场。每页仅驱动十二张卡片，一次随机则会更新全部三十六套配色与细节。</p>
        </section>

        <div className="toolbar" aria-label="常用操作">
          <button className="button button-primary" onClick={randomizeAll}>
            <span aria-hidden="true">✦</span> 一键全部随机
          </button>
          <button className="button" onClick={() => setPlaying((value) => !value)}>
            {playing ? "暂停" : "播放"}
          </button>
          <button
            className="button button-quiet"
            onClick={() => {
              setCards(makeCards(20260807));
              setPageIndex(0);
              setNotice("已恢复三十六款默认动态");
            }}
          >
            重置
          </button>
          <span className="toolbar-status" aria-live="polite">{notice}</span>
        </div>

        <nav className="page-tabs" aria-label="效果分页">
          {pages.map((page, index) => (
            <button
              key={page.range}
              className="page-tab"
              aria-current={pageIndex === index ? "page" : undefined}
              onClick={() => setPageIndex(index)}
            >
              <span>{page.range}</span>
              <small>{page.title}</small>
            </button>
          ))}
        </nav>

        <footer>
          <span>ONE WEBGL CONTEXT · THIRTY-SIX MOTION STUDIES</span>
          <span>400 × 100 · COLOR AREA 75%</span>
        </footer>
      </div>
    </aside>

    <section className="gallery-panel workspace" aria-label="三十六张动态效果卡片">
      <AtlasGallery key={pageIndex} configs={visibleCards} playing={playing} />
    </section>
  </div>
</main>
```

- [ ] **Step 4: Rebuild and verify the rendered test passes**

Run:

```powershell
npm run build
node --test tests/rendered-html.test.mjs
```

Expected: all rendered HTML tests pass; the output still contains twelve studies and twelve canvases.

- [ ] **Step 5: Commit Task 1**

```powershell
git add app/layout.tsx app/page.tsx tests/rendered-html.test.mjs
git commit -m "feat: brand the spectra flux gallery"
```

### Task 2: Sticky Split Layout and Responsive Fallback

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `.studio-shell`, `.control-rail`, `.control-rail-inner`, and `.gallery-panel` from Task 1.
- Produces: the approved desktop sticky rail, stacked medium layout, and single-column mobile gallery.

- [ ] **Step 1: Write the failing CSS layout test**

Add a focused test:

```js
test("SPECTRA FLUX uses a sticky left rail and responsive gallery", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(
    css,
    /\.studio-shell\s*\{[^}]*grid-template-columns:\s*minmax\(280px, 320px\) minmax\(0, 848px\)/s,
  );
  assert.match(
    css,
    /\.control-rail-inner\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/s,
  );
  assert.match(
    css,
    /@media \(max-width: 1100px\)[\s\S]*\.studio-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0, 848px\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 1100px\)[\s\S]*\.control-rail-inner\s*\{[^}]*position:\s*static/,
  );
});
```

- [ ] **Step 2: Run the CSS test and verify RED**

Run:

```powershell
node --test tests/rendered-html.test.mjs
```

Expected: the new test fails because `.studio-shell` and `.control-rail-inner` have no layout rules.

- [ ] **Step 3: Implement the minimum desktop split layout**

Replace the top-level centered-page, intro, workspace, toolbar, tabs, and footer positioning rules while leaving all card and WebGL canvas rules intact. The required CSS skeleton is:

```css
.studio {
  width: min(100%, 1300px);
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 34px;
}

.studio-shell {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 848px);
  justify-content: center;
  gap: 64px;
  align-items: start;
}

.control-rail { min-width: 0; }

.control-rail-inner {
  position: sticky;
  top: 0;
  min-height: 100vh;
  padding: 0 0 28px;
  display: flex;
  flex-direction: column;
}

.studio-header {
  min-height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  border-bottom: 1px solid var(--line);
}

.brand { min-width: 132px; }
.header-meta { gap: 7px; font-size: 8px; }
.header-meta > span:first-child { display: none; }

.intro {
  display: block;
  padding: 56px 0 34px;
}

.intro h1 {
  margin: 0;
  font-size: clamp(58px, 5.4vw, 78px);
  line-height: .86;
  letter-spacing: -.075em;
  font-weight: 780;
}

.intro p { margin: 28px 0 0; font-size: 13px; line-height: 1.75; }
.workspace { min-width: 0; padding: 78px 0 54px; }
.toolbar { width: 100%; margin: 0 0 26px; }
.page-tabs { width: 100%; margin: 0 0 28px; grid-template-columns: 1fr; }
.atlas-gallery { width: 100%; margin: 0; }
footer { margin-top: auto; display: grid; justify-content: stretch; }
```

Keep the existing button, card, card-grid, hover, and reduced-motion declarations.

- [ ] **Step 4: Add the approved stacked responsive rules**

Use the exact breakpoints:

```css
@media (max-width: 1100px) {
  .studio-shell { grid-template-columns: minmax(0, 848px); }
  .control-rail-inner { position: static; min-height: 0; padding-bottom: 0; }
  .header-meta > span:first-child { display: inline; }
  .intro { padding-bottom: 38px; }
  .toolbar { width: min(100%, 400px); margin: 0 auto 26px; }
  .page-tabs { width: min(100%, 848px); margin: 0 auto 28px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .workspace { padding-top: 0; }
  footer { margin-top: 54px; display: flex; justify-content: space-between; }
}

@media (max-width: 900px) {
  .atlas-gallery { grid-template-columns: minmax(0, 400px); justify-content: center; }
}
```

Retain the existing `760px` mobile rules and adjust only selectors whose layout assumptions changed.

- [ ] **Step 5: Run the focused and full automated checks**

Run:

```powershell
node --test tests/rendered-html.test.mjs
npm run lint
npm test
```

Expected: lint exits zero and all 30 tests pass (the existing 29 plus the new sticky-layout test).

- [ ] **Step 6: Commit Task 2**

```powershell
git add app/globals.css tests/rendered-html.test.mjs
git commit -m "feat: add sticky split gallery layout"
```

### Task 3: Browser Verification

**Files:**
- Modify only if a verified browser defect requires a TDD fix.

**Interfaces:**
- Consumes: the completed SPECTRA FLUX page at `http://localhost:3000/`.
- Produces: visual evidence that the approved layout and existing interactions work at desktop and narrow widths.

- [ ] **Step 1: Verify the desktop page**

Reload `http://localhost:3000/` in the local browser and inspect at the normal desktop viewport. Confirm:

```text
SPECTRA FLUX is visible in the left rail.
The rail remains visible while the right page scrolls.
The right panel contains 12 cards in two columns.
The first and last labels on page 1 are 01 · 柔雾扩散 and 12 · 雾幕呼吸.
No browser console errors or UNHANDLED SCRIPT ERROR overlay appears.
```

- [ ] **Step 2: Verify responsive behavior**

Set the browser viewport to `900 × 900`, reload, and confirm the control rail stacks above the gallery. Set it to `760 × 900` and confirm the cards render in one column without horizontal overflow. Reset the temporary viewport override afterward.

- [ ] **Step 3: Verify existing interactions**

At desktop width:

```text
Click 13–24 and confirm labels 13 · 油膜涌色 through 24 · 虹彩脉络.
Click 一键全部随机 and confirm the notice contains 三十六款已全部随机.
Click 暂停 and confirm the control changes to 播放 and the header reads PAUSED.
Click 播放, then 重置 and confirm page 01–12 returns.
```

- [ ] **Step 4: Run final verification and inspect Git state**

Run:

```powershell
npm run lint
npm test
git diff --check
git status --short
```

Expected: lint and build succeed, all tests pass, `git diff --check` emits no errors, and the worktree is clean.
