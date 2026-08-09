# Compact Cards and Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make curated cards visibly tighter with 10px corners and prevent the homepage from briefly claiming that no work exists while shared curation is loading.

**Architecture:** Keep the change inside the existing page, renderer, embed output, and stylesheet. `useCuration()` already exposes `hydrated`; the homepage will use that signal as the single loading gate, while CSS grid places recipe details and actions on one row so the homepage retains the same grid and row structure as the library.

**Tech Stack:** React 19, TypeScript, CSS Grid, Node test runner, Vinext/Vite, Cloudflare Workers.

## Global Constraints

- Dynamic cards use exactly `10px` corners on the homepage, library, lab, embed page, and copied iframe.
- The homepage and library share the existing two-column atlas, `30px × 48px` gap, and responsive one-column rule.
- Homepage recipe details and card actions share one grid row, matching the library's single action row; action targets remain at least `44px` high.
- Before the first shared curation read finishes, the homepage shows `正在加载共享作品…` and never shows `尚未添加动态作品`.
- Do not change WebGL behavior, recipe data, Cloudflare KV contents, authentication, or dependencies.

---

### Task 1: Compact card geometry

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `tests/embed-core.test.mjs`
- Modify: `app/globals.css`
- Modify: `app/library/page.tsx`
- Modify: `app/lab/page.tsx`
- Modify: `app/render/recipe-atlas.tsx`
- Modify: `app/embed/embed-card.tsx`
- Modify: `app/embed/embed-core.ts`

**Interfaces:**
- Consumes: existing `--card-radius` CSS custom property and `buildEmbedSnippet(recipe, origin)`.
- Produces: visually consistent 10px cards and an iframe snippet containing `border-radius:10px`.

- [ ] **Step 1: Write the failing geometry tests**

Add to `tests/rendered-html.test.mjs`:

```js
test("curated cards use compact rows and ten-pixel corners", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const library = await readFile(new URL("../app/library/page.tsx", import.meta.url), "utf8");
  const lab = await readFile(new URL("../app/lab/page.tsx", import.meta.url), "utf8");
  const recipes = await readFile(new URL("../app/render/recipe-atlas.tsx", import.meta.url), "utf8");
  const embed = await readFile(new URL("../app/embed/embed-card.tsx", import.meta.url), "utf8");

  assert.match(css, /\.atlas-gallery\s*\{[^}]*gap:\s*30px 48px/s);
  assert.match(css, /\.recipe-atlas \.card-study\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.recipe-atlas \.card-actions\s*\{[^}]*grid-column:\s*2/s);
  for (const source of [library, lab, recipes, embed]) {
    assert.match(source, /"--card-radius": "10px"|radius: 10/);
  }
});
```

In `tests/embed-core.test.mjs`, change the iframe assertion to:

```js
assert.match(html, /border-radius:10px/);
```

- [ ] **Step 2: Run the geometry tests and verify RED**

Run:

```bash
node --test tests/rendered-html.test.mjs tests/embed-core.test.mjs
```

Expected: FAIL because current cards and iframe still use `54px`, and homepage recipe controls occupy two rows instead of the library's single action row.

- [ ] **Step 3: Implement the minimal geometry changes**

In `app/globals.css`, keep the shared `.atlas-gallery` gap unchanged and add only the scoped recipe row layout, then update the embed error corner:

```css
.recipe-atlas .card-study {
  grid-template-columns: minmax(0, 1fr) auto;
}

.recipe-atlas .study-meta,
.recipe-atlas .preview-card {
  grid-column: 1 / -1;
}

.recipe-atlas .recipe-details {
  grid-column: 1;
  align-self: center;
}

.recipe-atlas .card-actions {
  grid-column: 2;
  align-items: center;
}
```

Set existing card radius values to `10`/`10px`:

```tsx
// app/library/page.tsx
radius: 10,

// app/lab/page.tsx and app/render/recipe-atlas.tsx
"--card-radius": "10px",

// app/embed/embed-card.tsx cardStyle
"--card-radius": "10px",
```

In `app/embed/embed-core.ts`, change the iframe inline style to:

```ts
style="border:0;border-radius:10px;overflow:hidden"
```

Change `.embed-error` in `app/globals.css` from `54px` to `10px`.

- [ ] **Step 4: Run geometry tests and verify GREEN**

Run:

```bash
node --test tests/rendered-html.test.mjs tests/embed-core.test.mjs
```

Expected: all selected tests PASS.

- [ ] **Step 5: Commit compact card geometry**

```bash
git add app/globals.css app/library/page.tsx app/lab/page.tsx app/render/recipe-atlas.tsx app/embed/embed-card.tsx app/embed/embed-core.ts tests/rendered-html.test.mjs tests/embed-core.test.mjs
git commit -m "style: compact curated cards"
```

---

### Task 2: Honest homepage loading state

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `app/page.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `hydrated: boolean` returned by `useCuration()`.
- Produces: a `showcase-loading` status shown only while `hydrated === false`.

- [ ] **Step 1: Write the failing loading-state test**

Update the initial homepage render test in `tests/rendered-html.test.mjs`:

```js
test("server-renders shared curation as loading before hydration", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /正在加载共享作品/);
  assert.match(html, /class="showcase-loading"/);
  assert.doesNotMatch(html, /尚未添加动态作品/);
});
```

Add a CSS assertion:

```js
assert.match(css, /\.showcase-loading\s*\{/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.showcase-loading::after/);
```

- [ ] **Step 2: Run the homepage test and verify RED**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
```

Expected: FAIL because the initial server render still contains `尚未添加动态作品` and has no loading status.

- [ ] **Step 3: Gate homepage content on hydration**

In `app/page.tsx`, make loading the first branch:

```tsx
{!hydrated ? (
  <div className="showcase-loading" role="status">
    <span className="eyebrow">SYNCING SHARED CURATION</span>
    <p>正在加载共享作品…</p>
  </div>
) : visibleEntries.length > 0 ? (
  <RecipeAtlas
    entries={visibleEntries}
    playing={playing}
    onRemove={admin.authenticated ? removeFromHome : undefined}
  />
) : (
  <div className="empty-showcase">
    <span className="eyebrow">YOUR COLLECTION STARTS HERE</span>
    <h2>尚未添加动态作品</h2>
    <p>先浏览单效果，或让多个动态在同一张卡片里融合。</p>
    <div className="empty-actions">
      <a className="button button-primary" href="/library">进入效果库</a>
      <a className="button" href="/lab">开始随机创作</a>
    </div>
  </div>
)}
```

In `app/globals.css`, add a restrained placeholder:

```css
.showcase-loading {
  width: min(100%, 400px);
  margin: 0 auto;
  color: var(--muted);
}

.showcase-loading p { margin: 0 0 18px; font-size: 12px; }

.showcase-loading::after {
  content: "";
  display: block;
  width: 100%;
  aspect-ratio: 4 / 1;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: linear-gradient(100deg, #fff 20%, #ececef 42%, #fff 64%);
  background-size: 220% 100%;
  animation: loading-sheen 1.4s ease-in-out infinite;
}

@keyframes loading-sheen {
  to { background-position: -220% 0; }
}
```

Inside the existing reduced-motion media query add:

```css
.showcase-loading::after { animation: none; }
```

- [ ] **Step 4: Run loading-state tests and verify GREEN**

Run:

```bash
npm run build && node --test tests/rendered-html.test.mjs
```

Expected: the homepage loading test and all rendered HTML tests PASS.

- [ ] **Step 5: Commit homepage loading state**

```bash
git add app/page.tsx app/globals.css tests/rendered-html.test.mjs
git commit -m "fix: show shared curation loading state"
```

---

### Task 3: Full verification and production deployment

**Files:**
- Verify only; no new application files.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: tested GitHub `master` and deployed Worker on `spectra.8538690.xyz`.

- [ ] **Step 1: Run the full local verification suite**

```bash
npm test
npm run lint
git diff --check
```

Expected: all tests PASS, lint reports zero errors, and `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Verify in a browser before deployment**

Start the app with local Cloudflare secrets, open the homepage, and verify:

1. Initial render shows `正在加载共享作品…`, never the false empty-state message.
2. Loaded cards have 10px corners.
3. `查看配方` and `复制 HTML` share one row.
4. Homepage card rows align with the effect library while buttons remain easy to click.
5. Library, lab, and `/embed` cards use the same 10px corners.

- [ ] **Step 3: Merge and push the verified branch**

```bash
git switch master
git merge --ff-only codex/compact-card-loading
git push origin master
```

Expected: GitHub `master` advances to the two implementation commits.

- [ ] **Step 4: Build and deploy with the existing KV namespace**

PowerShell:

```powershell
$env:SPECTRA_CURATION_KV_ID='42f3a0b77fd1497a9f2e0f5ef45f32bb'
npm run build:cloudflare
npx wrangler deploy --config dist/server/wrangler.json
```

Expected: Wrangler deploys `spectra-flux` to `spectra.8538690.xyz` with the existing `CURATION_KV` binding.

- [ ] **Step 5: Verify the production site**

Open `https://spectra.8538690.xyz/`, hard refresh, then verify the loading gate, 10px corners, compact recipe controls, `/library`, `/lab`, copied iframe, and absence of browser console errors.
