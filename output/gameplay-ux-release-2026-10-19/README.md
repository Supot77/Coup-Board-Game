
## Gameplay decisions, history and shared response timing release — 2026-10-19

- Released the approved gameplay UX items 1–7; invitation links and QR (item 8) remain excluded. Includes response decisions, public table overview, confirmations, compact actions, optional sound, public round history/summary and persisted response windows with command recovery.
- Deployed `firebase deploy --project coup-49ffc --only firestore:rules` first, then `firebase deploy --project coup-49ffc --only hosting`. Both exited 0. Rules compiled and released; Hosting finalized and released the matching 49-file build.
- Verified 32 live HTTP resources returned 200 and matched the local build by SHA-256. Evidence: `output/gameplay-ux-release-2026-10-19/asset-manifest.json`; repeat with its sibling `verify-live.cjs`.
- Release checks passed: lint, TypeScript, build, session 6/6 and engine 13/13. Implementation verification also passed Spark integration 10/10, Rules 9/9, the existing responsive UI suites and the new gameplay UX suite across phone, tablet, desktop and landscape sizes.
- Only Rules and Hosting were deployed. No Functions, indexes, Realtime Database or billing changes. No live multiplayer room or physical-device test was performed. Spark timeout processing still depends on the creator's browser. Local Firebase cache is excluded from the source commit.
