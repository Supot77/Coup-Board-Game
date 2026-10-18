# Secret Council UI release — 2026-10-18

- Site: https://coup-49ffc.web.app
- Repository: https://github.com/Supot77/Coup-Board-Game
- Firebase CLI successfully released `firestore:rules`, then Hosting (42 files). No Functions, indexes, database rules or billing changes.
- All release quality gates passed: lint, TypeScript, build, session 6/6, engine 8/8, Spark commands 6/6, Rules 6/6, full isolated UI, lobby motion and loading checks.
- Nineteen production HTTP resources returned 200 and matched local build SHA-256 values. `asset-manifest.json` records the verified paths and hashes. Rebuilding before comparison reproduced the released bundle names/content.
- `live-login.png` is the rendered production login view. Release checks did not create a live multiplayer room; multiplayer/game behavior was exercised in isolated fixtures and emulators.
