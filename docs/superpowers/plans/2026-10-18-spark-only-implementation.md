# Spark-Only Coup Security and Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Coup app to an authenticated Firestore-only architecture that runs on Firebase Spark, with private-card boundaries, a best-effort 30-minute login timeout, eight-character room codes, and idle-lobby cleanup.

**Architecture:** Anonymous Authentication identifies guests. Firestore Rules allow room-scoped reads, owner-only private cards, and immutable member-authored command requests; the room creator's active browser applies commands using the existing Coup transition engine. Session timeout and lobby cleanup are browser-enforced. No Cloud Functions, Scheduler, TTL, billing account, or trial is used.

**Tech Stack:** React 19, TypeScript, Firebase Web SDK (Auth and Firestore), Firestore Rules Emulator, Firebase Hosting.

**Spec:** `docs/superpowers/specs/2026-10-18-spark-only-design.md`

## Global Constraints

- Firebase remains on Spark; do not start a trial, link Cloud Billing, enable paid services, or incur charges.
- Deploy only `firestore:rules` and `hosting`; do not deploy Cloud Functions, Scheduler jobs, or Firestore TTL.
- New rooms use eight-character codes from `ABCDEFGHJKLMNPQRSTUVWXYZ`; legacy rooms are not migrated or deleted.
- The room creator's client can inspect and alter all hidden game state; client timeout and cleanup are best-effort only.
- Preserve unrelated working-tree changes and do not commit, push, merge, or rebase.
- Update `docs/ui-improvements.md` and `docs/firestore-security-deployment.md` with final behavior, verification, and deployment state.

---

### Task 1: Make the Coup transition engine reusable by the Spark client

**Files:**
- Create: `src/core/gameEngine.ts` (copy the pure role/state types and transition logic from `functions/src/game.ts`)
- Modify: `functions/src/game.ts` only if its tests need a compatibility re-export
- Test: `tests/functions/game.test.cjs`
- Test: `tests/spark/game-engine.test.mjs`

**Interfaces:**
- Produces: `applyGameCommand(state: Aggregate, actorUid: string, command: Command): Aggregate`
- Produces: `createInitialDeck(): Role[]`, `GameRuleError`, and the `Aggregate`, `Command`, `Room`, `PublicPlayer`, `PrivatePlayer`, `Card`, and `Role` types.
- The browser treats the aggregate as private to the room creator; snapshots continue to publish public room and roster docs separately.

- [x] Copy the existing game-engine tests into `tests/spark/game-engine.test.mjs` and change the module import to `../../src/core/gameEngine.ts`.
- [x] Run `npm.cmd run test:spark-engine`; all eight existing Coup-rule cases pass against the shared source.
- [x] Add the pure engine at `src/core/gameEngine.ts` with no Admin SDK or Functions dependency. The old Functions source and tests remain archived in the workspace; auto-review rejected their deletion.
- [x] Run `npm.cmd run test:spark-engine` (8/8). The old Functions test target was removed from npm scripts because it is not deployed or used by the Spark client.

### Task 2: Replace callable room and game commands with Firestore client transactions

**Files:**
- Modify: `src/core/roomCommands.ts`
- Modify: `src/core/gameCommands.ts`
- Modify: `src/core/firebase.ts`
- Modify: `src/components/Lobby.tsx`
- Modify: `src/components/GameBoard.tsx`
- Create: `src/core/hostCommandProcessor.ts`
- Test: `tests/spark/commands.test.mjs`

**Interfaces:**
- `createRoom(displayName: string): Promise<{ roomCode: string }>` creates schema 3 room, invite metadata, host player, empty private hand, and internal deck document.
- `joinRoom(roomCode: string, displayName: string): Promise<{ roomCode: string }>` atomically increments invite count and creates the authenticated player's roster/private documents.
- `leaveRoom(roomCode: string, uid: string): Promise<void>` removes the player and transfers host when needed; last-player leave closes and removes the room tree.
- `kickPlayer(roomCode: string, targetUid: string): Promise<void>` is host-only in lobby.
- `startGame(roomCode: string, uid: string): Promise<void>` deals two cards per player in a host transaction and switches room/invite status to playing.
- `submitGameCommand(roomCode: string, uid: string, command: GameCommand): Promise<{ commandId: string }>` creates an immutable request and listens for its host-written result in the UI.
- `resetGame(roomCode: string, uid: string): Promise<void>` is host-only and starts a fresh 30-minute lobby window.
- `processHostCommand(roomCode: string, commandId: string, hostUid: string): Promise<void>` reads the current aggregate transactionally, applies the shared engine, and writes either updated canonical state plus a result or a rejection result without changing game state.

- [x] Add emulator tests for eight-character room creation, known-code joining, player limit, host-only start/kick/reset, and command author identity.
- [x] Implement room creation/join/leave/kick/start/reset with Firestore transactions and the new collection paths.
- [x] Implement immutable command submission and idempotent host-client processing; command results contain only actor, outcome, message, and completion time.
- [x] Update Lobby and GameBoard to pass the authenticated UID and nickname, show pending-host state, and remove callable Functions imports.
- [x] Run `npm.cmd run test:spark`; all four integration cases pass, including duplicate-processing protection.

### Task 3: Enforce the schema 3 Firestore access boundary

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Modify: `tests/rules/firestore.rules.test.mjs`
- Test: `tests/spark/commands.test.mjs`

**Interfaces:**
- Room membership uses `rooms/{code}/players/{request.auth.uid}` and schema version 3.
- Private-player reads are allowed only to the matching UID during play; the creator may read/list all private-player docs for command processing.
- Invite gets are allowed only for authenticated users and never list; room and player writes follow host/member-specific transitions.
- Members can create only their own command docs; only the host can write results and canonical gameplay state.
- Stale or already-closed room members can use a self-owned cleanup marker to finish deletion in bounded batches.

- [x] Extend Rules emulator fixtures for schema 3, room owner, ordinary member, outsider, unauthenticated user, expired lobby, invites, internal deck, commands, and results.
- [x] Add denied-access assertions for unauthenticated, nonmember, cross-player private reads, non-host canonical writes, invite enumeration, forged command actor, and legacy schema documents.
- [x] Add allowed-access assertions for known invite get, member room/roster reads, own private-hand reads, host private/deck access, authored command create, and host result/state writes.
- [x] Replace `firestore.rules` with schema 3 rules and verify atomic membership/capacity checks and cleanup transitions.
- [x] Run `npm.cmd run test:rules` (5/5) and `npm.cmd run test:spark` (4/4).

### Task 4: Implement local 30-minute session lock and retryable lobby cleanup

**Files:**
- Modify: `src/components/SessionProvider.tsx`
- Modify: `src/core/sessionClock.ts`
- Modify: `src/components/Lobby.tsx`
- Create: `src/core/roomMaintenance.ts`
- Modify: `tests/session-clock.test.mjs`
- Test: `tests/spark/commands.test.mjs` and `tests/rules/firestore.rules.test.mjs`

**Interfaces:**
- Session state persists per anonymous UID in `localStorage` as `{ active, displayName, expiresAt }` and expires after 30 minutes without activity.
- `beginSession(displayName)` resumes the existing anonymous UID and resets the local idle clock; timeout requires the login form again without discarding room identity.
- `markIdleLobbyForCleanup(roomCode, uid, now)` atomically closes a lobby after 30 minutes from `lastActivityAt` and creates the caller's cleanup marker.
- `finishLobbyCleanup(roomCode, uid)` deletes player, private-player, internal, command, result, invite, marker, and room docs using batches of at most 400 writes; it can resume after interruption.

- [x] Add local-session tests for persisted expiry, input reset, 29-minute warning, 30-minute lock, waiting-state pause, and explicit relogin with the same UID (6/6).
- [x] Add emulator coverage for active-lobby no-op, idle cleanup, return-triggered cleanup, and room removal.
- [x] Remove callable session APIs; persist the idle lock in browser-local state and keep Anonymous Auth.
- [x] Implement one-minute foreground lobby checks and a visibility-change retry; only meaningful lobby operations update `lastActivityAt`.
- [x] Implement a cleanup marker and bounded, resumable cleanup batches; do not clean rooms after they enter play.
- [x] Run `npm.cmd run test:session` (6/6), `npm.cmd run test:spark` (4/4), and `npm.cmd run test:rules` (5/5).

### Task 5: Update app copy, configuration, and deployment documentation

**Files:**
- Modify: `src/components/Login.tsx`
- Modify: `src/components/Lobby.tsx`
- Modify: `src/components/GameBoard.tsx`
- Modify: `src/core/firebase.ts`
- Modify: `firebase.json`
- Modify: `package.json`
- Modify: `docs/ui-improvements.md`
- Modify: `docs/firestore-security-deployment.md`
- Modify: `docs/superpowers/specs/2026-10-18-spark-only-design.md`

**Interfaces:**
- Login explains the 30-minute inactivity behavior in plain Thai.
- Lobby accepts only eight allowed code characters and shows that room creators process game actions while online.
- GameBoard tells non-hosts when their action is waiting for the room creator and explains when creator return is needed.
- Firebase initialization exports only Auth and Firestore; deployment config has no Functions target.
- Security and UI docs report the actual Spark architecture, limitations, tests, and production deployment status.

- [x] Update code input label, length, normalization, validation, and examples to eight characters; preserve existing responsive styling.
- [x] Remove callable imports/config and Functions emulator/npm targets used by the browser app; retain historical Functions source as unused workspace material and remove its deployment target.
- [x] Replace billing-gated instructions with Spark-only steps and document host trust, local session enforcement, and offline cleanup limits.
- [x] Update the improvement log with changed files, behavior, and verification.
- [x] Run `npm.cmd run lint`, `npx.cmd tsc --noEmit`, and `npm.cmd run build` successfully.

### Task 6: Verify deployment scope and publish Spark-only release

**Files:**
- Verify: `firestore.rules`
- Verify: `firebase.json`
- Verify: production Hosting output in `dist/`

**Interfaces:**
- Deployment command is restricted to `firestore:rules` followed by `hosting`.
- Production verification uses two anonymous accounts to create/join a fresh room, start a game, submit an action, and confirm private-card access boundaries.

- [x] Run the full pre-deploy gate: session 6/6, engine 8/8, Spark integration 4/4, Rules 5/5, lint, TypeScript, and production build all pass.
- [x] Inspect `firebase.json`; verify the deploy commands are limited to `firestore:rules` and `hosting`, with no Functions, Scheduler, indexes, Database, or billing target.
- [x] Deploy `firebase deploy --only firestore:rules` to close the public Firestore access before hosting changes.
- [x] Deploy `firebase deploy --only hosting` on Spark; the live app loads at `https://coup-49ffc.web.app`.
- [x] Verify the live two-guest flow, eight-character code, private-card boundary, host-processed action, blocked non-host write, and idle-room cleanup; delete the smoke-test room and both temporary guest accounts. Session timeout behavior is covered by unit tests; the deployment guide records remaining client-side limits.
