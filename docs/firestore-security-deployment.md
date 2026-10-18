# Firebase Spark security and deployment

## Current production state

The Firebase project is `coup-49ffc` on Spark. Anonymous Authentication is enabled. No Cloud Billing account is linked, and no trial has been started. Firebase CLI confirmed the Firestore database reports `freeTier: true`. No billing or trial action was taken for this release. The separate, unused Realtime Database has deny-all rules deployed; the app uses Cloud Firestore.

Before this release, Firestore had its public read/write rule and Hosting used the old room format. On 2026-10-18, the new Rules were deployed first and the matching Hosting client followed. The brief transition has finished; Firestore is no longer public under the deployed Rules.

## Spark-only implementation

- The browser uses Anonymous Authentication and the Firestore client SDK. No Functions or Scheduler deployment is configured.
- New rooms use schema version 3, eight-character invite codes, separate public/private documents, and a host-processed command queue. Only the room creator's browser writes gameplay state and it can see every player's hidden cards.
- The 30-minute login timeout and one-minute warning are stored in the browser. They can be bypassed by a modified client.
- Foreground room pages check idle lobby cleanup once per minute. If every member closes the app, cleanup waits until someone returns with the saved room code.
- Legacy room data is not migrated or deleted. The new Rules deny access to the old schema; users must create fresh rooms after release.
- Spark quotas still apply. If the app exceeds a free quota, Firebase may pause that operation until the quota interval resets. The app has no paid fallback.

The old Functions source tree is retained as historical workspace material and is no longer referenced by the app, npm test scripts, or `firebase.json`. Do not deploy it.

## Verification before deployment

From the project root, run:

```powershell
npm.cmd run test:session
npm.cmd run test:spark-engine
npm.cmd run test:spark
npm.cmd run test:rules
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
```

The emulator tests cover anonymous create/join, six-player capacity, host-only start/kick/reset, host command processing and idempotence, own-card access, stale lobby deletion, and Rules denial for unauthenticated users, outsiders, legacy documents, cross-player private reads, direct non-host writes, forged command authors, and invite enumeration. Final counts: session 6/6, game engine 8/8, Spark client integration 4/4, Rules 5/5; lint, TypeScript, and production build passed.

## Spark-only release

Check the Firebase CLI is authenticated and that `firebase.json` contains only the approved project resources. Publish Rules first, then the matching Hosting client:

```powershell
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

Do not run `firebase deploy` without `--only`. Do not deploy Functions, Scheduler, Firestore TTL, Realtime Database rules, or indexes for this release. No billing-plan or payment action is part of these commands.

The live site loads at [coup-49ffc.web.app](https://coup-49ffc.web.app). A temporary two-guest smoke test against production created and joined an eight-character room, started a game, confirmed the non-host guest could read its own private cards but not the host's, processed an action through the host, rejected a non-host gameplay write, and removed an idle lobby. The test room and both temporary anonymous accounts were deleted. The 30-minute sign-in timeout was checked by unit tests rather than waiting 30 minutes in production.

## Deployment record

- Firestore Rules deployed: 2026-10-18; `cloud.firestore` release updated successfully
- Hosting deployed: 2026-10-18; live version released at `https://coup-49ffc.web.app`
- Live checks: site load and temporary two-guest room/game/privacy/cleanup smoke passed; no temporary room or test accounts remain
- Billing account/trial changes: none; Firestore reports `freeTier: true`

## Secret Council UI and readiness release — 2026-10-18

- The user explicitly authorized deployment and GitHub delivery of the completed UI refresh, including the long-table lobby, shadowed male/female readiness sprites, PNG role cards, sword loading screen, game-board styling and victory presentation.
- Deployed `firestore:rules` first to `coup-49ffc`; compilation and release to `cloud.firestore` succeeded. Deployed Hosting next; Firebase finalized and released the 42-file build at `https://coup-49ffc.web.app`.
- Rules now validate new avatar/readiness fields and allow only a member's own boolean readiness change in a live lobby. The authoritative start transaction requires 2–6 current members all ready and clears readiness on start/reset. Private-hand boundaries and the Spark-only architecture remain.
- Before release: lint, TypeScript, production build, session-clock (6/6), Spark engine (8/8), Spark client commands (6/6), Firestore Rules (6/6), full isolated UI regression, focused lobby-motion checks and sword-loading checks passed. Emulator runs used demo project IDs.
- Production verification: 19 HTTP resources returned 200 and matched the rebuilt local artifacts byte-for-byte by SHA-256, including the entry HTML/bundles, male/female sprites, long table, loading sword and Duke portrait. The production login page was rendered and visually inspected. Evidence: `output/release-2026-10-18/live-login.png` and `asset-manifest.json`.
- This release verification did not create a live multiplayer room or exercise gameplay in production. The existing earlier production smoke record above describes the prior release, not this UI release.
- No Functions, Scheduler, indexes, Realtime Database rules, billing-plan or trial changes were deployed. Deployment cache remains local and is excluded from the UI commit.

## Room recovery and guest result hotfix — 2026-10-18

- Released Firestore Rules first, then the matching 42-file Hosting build to `coup-49ffc`. Both Firebase deployment commands succeeded.
- A member can now subscribe to an absent command result while their own same-ID immutable command is pending. Completed result reads still check the author. Cross-player/unknown result reads, result enumeration and guest result writes remain denied.
- Lobby/game listeners forget stale room pointers on terminal membership errors. Denied leave returns to create/join; cached absence and transient connection failure preserve the room. Session name/avatar are retained.
- Checks passed: Rules 7/7 (the new pending-result case failed before the change), Spark commands 7/7, engine 8/8, session 6/6, lint, TypeScript, production build, full responsive UI suite, focused lobby motion and mobile-touch room recovery. Live HTTP checks matched the deployed entry HTML, linked bundles and game-board chunk to the local build by SHA-256.
- This hotfix verification used emulators and isolated UI fixtures. It did not exercise a physical phone or create a live multiplayer room. Only Firestore Rules and Hosting were deployed.
