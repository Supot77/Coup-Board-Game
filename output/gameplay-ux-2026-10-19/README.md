# Gameplay UX review captures

Implementation scope: approved review items 1–7, excluding invitation links/QR.

Open `decision-320.png` to inspect the four visible response choices on a small phone. The summary/countdown and controls stay in place while the illustration/help area scrolls. `target-confirm-390.png` shows the final target step; `round-summary-390.png` shows recorded round statistics. All screenshots use local fixture data.

Run the isolated preview:

```powershell
npm.cmd run dev -- --config tests/ui/vite.config.ts --port 5299
```

Run the new browser checks in another terminal:

```powershell
$env:UI_TEST_BASE='http://127.0.0.1:5299/tests/ui/index.html'
node tests/ui/verify-gameplay-ux.cjs 'D:/Coup/node_modules/.entry-preview-tools/node_modules/playwright' 'C:/Program Files/Google/Chrome/Application/chrome.exe'
```

Use this checkout's existing optional Playwright runtime and system Chrome paths, or omit them when Playwright and its browser are available through the standard module resolution paths. The fixture aliases all game/Firestore writes locally.

See `docs/ui-improvements.md`, section 30, for changed files, test evidence and the browser-host execution limits. Rules and Hosting were deployed on 2026-10-19; release evidence is in `output/gameplay-ux-release-2026-10-19/`.
