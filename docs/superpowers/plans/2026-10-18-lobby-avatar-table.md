# Lobby Table and Player Avatar Implementation Plan

> **Visual revision:** The user subsequently approved card-style sprite avatars and a long table so everyone faces the viewer. The original round-table/SVG steps below describe the initial implementation; the current long-table integration and verification are recorded in `output/avatar-motion-2026-10-18/README.md`.

> **For agentic workers:** Complete. The male and female avatars, readiness table, Firestore flow, and test coverage are implemented. The isolated UI and Emulator suites passed using temporary local tooling.

**Goal:** Build a working six-seat lobby table with selectable role-neutral avatars whose pose reflects each player's real readiness state.

**Architecture:** Keep the table and seat layout in a focused CouncilTable component, and render grouped inline SVG avatars through a reusable PlayerAvatar component. Persist the selected male/female avatar when a member is created; drive readiness through the active Firestore transaction and narrowly scoped rules. Sort occupants by document ID so all clients map the same roster to seats without adding a seat field.

**Tech Stack:** React 19, TypeScript, SVG, CSS, Firebase Firestore transactions and rules, existing Vite/Playwright UI harness, Firebase emulator tests.

**Spec:** `docs/superpowers/specs/2026-10-18-lobby-avatar-table-design.md`

## Global Constraints

- Draw the table and six fixed chairs with SVG and CSS. Keep each chair as a stable seat position mapped from the live roster; do not bake people, labels, controls, or game state into a bitmap.
- Show occupied characters seated behind the table with their upper body and arms visible. Keep unoccupied seats visible as quiet placeholders labelled “ที่นั่งว่าง”.
- Offer two selectable, ordinary-player avatars: one male and one female. Use simple vector shapes and understated clothing that fits the Secret Council setting. Include no rank marks, role symbols, weapons, or props that could imply a hidden card.
- Build each avatar from grouped SVG elements for the head and hair, torso, and arms. Reuse those groups for both poses. Assign a muted clothing palette deterministically from the player's ID so all clients render the same player consistently; palette choice does not encode a role.
- The not-ready pose is relaxed, with the arms resting near the table. The ready pose leans slightly inward and moves an arm forward. Show explicit ready text and a check indicator alongside the pose.
- Keep the existing role portraits and background files separate from player avatars. The only new character artwork required for this lobby design is the two base SVG avatars; table, chairs, status marks, and motion are UI elements.
- Sort players by document ID in ascending lexical order and map them to the fixed seats starting at the top and continuing clockwise. Do not add a seat field. If sorting moves an existing occupant after a roster change, reposition that player immediately without animation; animate only the newly joined player.
- Use public isReady as the only readiness source. New members start with isReady false; treat missing readiness on legacy records as false. A member may update only their own readiness in a live lobby.
- The owner can start with 2–6 current members only when every member is ready. Re-read the invite and current player records in the final transaction; reject stale or unready rosters with an actionable message. Starting and resetting clear readiness while preserving avatar IDs.
- Use only the active src/core command path. Do not add this feature to functions/src, weaken rules broadly, expose private cards, deploy Firebase, or write to a live project.
- The male SVG was presented before the user asked to finish the complete UI; use its line weight, shape language and palette for the matching female SVG.
- Preserve all existing working-tree changes. Do not commit, push, or discard changes unless the user asks.

## File Map

- `src/types.ts`: shared `PlayerAvatarId` and UI roster fields; legacy avatar and readiness fields remain optional when reading old documents.
- `src/core/gameEngine.ts`: public player type includes avatar and readiness fields; no private hand data moves into the public roster.
- `src/core/roomCommands.ts`: create/join avatar persistence, self-readiness transaction, authoritative start checks, and readiness reset.
- `firestore.rules`: validate avatar/readiness on new member creation and permit the narrow self-readiness update in a live lobby.
- `src/components/AvatarPicker.tsx` (new): accessible male/female selection before create or join.
- `src/components/PlayerAvatar.tsx` (new): role-neutral grouped SVG avatar, silhouette fallback, deterministic clothing palette, and pose state.
- `src/components/CouncilTable.tsx` (new): six fixed SVG/CSS seats and public roster presentation.
- `src/components/Lobby.tsx`: connect the picker, table, live roster, readiness controls, and existing owner actions.
- `src/index.css`: lobby table layout, avatar group transforms, status indicators, focus styles, responsive rules, and reduced-motion handling.
- `tests/spark/commands.test.mjs`: create/join avatar values, readiness transaction, start validation, stale-roster behavior, and reset behavior.
- `tests/rules/firestore.rules.test.mjs`: player creation validation and exact readiness update permissions.
- `tests/ui/firestore.ts`, `tests/ui/roomCommands.ts`, `tests/ui/preview.tsx`, `tests/ui/verify.cjs`: realistic lobby fixtures, UI command adapters, preview scenarios, interactions, viewport checks, and screenshots.
- `docs/ui-improvements.md`: changed files, visible behavior, public roster/rule changes, and checks actually run.

## Card Artwork Follow-up — completed with the UI refresh

The lobby avatar work does not finish the game-card visuals. Keep these as separate assets and UI work:

- The five role portraits already exist in `public/img/DUKE.png`, `ASSASSIN.png`, `CAPTAIN.png`, `AMBASSADOR.png`, and `CONTESSA.png`. These are character art only, without card frames or labels.
- `src/components/PlayingCard.tsx` now uses the five uppercase PNG role portraits in `public/img/` inside a shared DOM/SVG frame with HTML role labels and state styling.
- Own hand, revealed opponents and Exchange use the shared card component; hidden opponents use one SVG card back and never load a role portrait.
- Card labels and game state remain outside bitmap art. No additional role-card artwork is pending.

## Task 1: Add Avatar and Initial Readiness to New Roster Records

**Files:**
- Modify: `src/types.ts`
- Modify: `src/core/gameEngine.ts`
- Modify: `src/core/roomCommands.ts`
- Modify: `firestore.rules`
- Test: `tests/spark/commands.test.mjs`
- Test: `tests/rules/firestore.rules.test.mjs`

**Interfaces:**
- Produce `PlayerAvatarId = 'male' | 'female'` in `src/types.ts`.
- Change to `createRoom(displayName: string, avatarId: PlayerAvatarId, uid?: string, database?: Firestore)` while preserving the existing optional UID and database parameters.
- Change to `joinRoom(codeInput: string, displayName: string, avatarId: PlayerAvatarId, uid?: string, database?: Firestore)` while preserving the existing optional UID and database parameters.
- New `PublicPlayer` records contain `avatarId` and `isReady: false`; legacy reads may omit either field.

- [x] **Step 1: Extend the existing create/join Spark tests with the avatar contract.** Update every existing `createRoom` and `joinRoom` call in the test file for the new avatar argument while preserving each UID and database argument. Assert the created public player documents contain their selected ID and `isReady === false`.

```js
({ roomCode } = await createRoom('Host', 'female', host.uid, host.db));
await joinRoom(roomCode, 'Guest', 'male', guest.uid, guest.db);
const hostPlayer = (await getDoc(doc(host.db, `rooms/${roomCode}/players/${host.uid}`))).data();
const guestPlayer = (await getDoc(doc(guest.db, `rooms/${roomCode}/players/${guest.uid}`))).data();
assert.equal(hostPlayer.avatarId, 'female');
assert.equal(guestPlayer.avatarId, 'male');
assert.equal(hostPlayer.isReady, false);
assert.equal(guestPlayer.isReady, false);
```

- [x] **Step 2: Run the focused command suite and verify the new assertions after implementation; the final suite passed.**

Run: `npm.cmd run test:spark`

Expected: create/join persist validated avatar IDs and start readiness at false; the focused suite passes.

- [x] **Step 3: Add the shared model fields and validated create/join arguments.** Define the union in `src/types.ts`; use it in `Player` and `PublicPlayer` without duplicating the union type. Update `makePlayer` to set `isReady: false` and include an avatar ID when one is provided. Require and validate `male` or `female` in `createRoom` and `joinRoom`, and persist it in the same transaction that creates the player document. Update every source and test call site to pass the new argument while preserving UID/database positions. Do not change existing-member behavior in `joinRoom`.

```ts
export type PlayerAvatarId = 'male' | 'female';
```

- [x] **Step 4: Extend `validPlayer` to accept only the new validated fields on player creation.** Keep all prior field checks, allow only `avatarId` and `isReady` in addition to existing public fields, require `avatarId` to be one of the two IDs and `isReady == false`. Update rule fixtures that create a new member to include those values; keep legacy fixture documents unchanged where absence is intentional.
- [x] **Step 5: Run the command and rule suites.**

Run: `npm.cmd run test:spark`

Run: `npm.cmd run test:rules`

Expected: create/join store the selected avatar and initial false readiness; invalid avatar IDs and malformed public member documents are rejected.

## Task 2: Add the Narrow Readiness Transaction and Firestore Rule

**Files:**
- Modify: `src/core/roomCommands.ts`
- Modify: `firestore.rules`
- Test: `tests/spark/commands.test.mjs`
- Test: `tests/rules/firestore.rules.test.mjs`

**Interfaces:**
- Produce `setPlayerReady(codeInput: string, isReady: boolean, uid?: string, database?: Firestore): Promise<void>`.
- The command updates only the authenticated member's public `isReady` field.

- [x] **Step 1: Add rules tests for the exact allowed and rejected updates.** Assert an authenticated member can update their own `isReady` while the room is a lobby. Assert the host cannot edit a guest's readiness, a guest cannot edit the host's readiness, an outsider cannot update a member, a player cannot combine readiness with a coins/name/avatar edit, and a member cannot change readiness after the room starts.

```js
await assertSucceeds(updateDoc(doc(host, 'rooms/BCDEFGHJ/players/host'), { isReady: true }));
await assertFails(updateDoc(doc(guest, 'rooms/BCDEFGHJ/players/host'), { isReady: true }));
await assertFails(updateDoc(doc(host, 'rooms/BCDEFGHJ/players/host'), { isReady: true, coins: 99 }));
await assertFails(updateDoc(doc(guest, 'rooms/GAMEPLAY/players/guest'), { isReady: true }));
```

- [x] **Step 2: Run the rules suite and verify the allowed and rejected permission cases after implementation; the final suite passed.**

Run: `npm.cmd run test:rules`

Expected: self-readiness is rejected by the current host-only player update rule; the existing denial cases remain denied.

- [x] **Step 3: Implement `setPlayerReady` as a Firestore transaction.** Read the room and the caller's player document inside the transaction. Require schema version 3, live `lobby` status, no cleanup in progress, and existing membership. Call `transaction.update(playerRef, { isReady })` only; do not update the room, invite, avatar, coins, or other roster fields.
- [x] **Step 4: Narrow the player update rule.** Preserve host-controlled updates. Add a second branch requiring a signed-in member, matching `playerUid == request.auth.uid`, room status `lobby`, a boolean new value, and a document diff whose only affected key is `isReady`. Do not allow avatar updates through this branch.
- [x] **Step 5: Add Spark command coverage for toggling both directions and rejecting calls outside a live lobby.** Verify the host and a member can set their own readiness; verify a nonmember, a missing member record, and a player after game start are rejected.
- [x] **Step 6: Run the rules and Spark suites.**

Run: `npm.cmd run test:rules`

Run: `npm.cmd run test:spark`

Expected: only a member's own boolean readiness changes during a live lobby; every other roster mutation remains host-controlled.

## Task 3: Enforce Ready-Only Start and Reset Semantics

**Files:**
- Modify: `src/core/roomCommands.ts`
- Test: `tests/spark/commands.test.mjs`

**Interfaces:**
- Keep the existing `startGame(codeInput, uid?, database?)` and `resetGame(codeInput, uid?, database?)` entry points.
- Start validation uses the invite player count plus the current player records re-read in the transaction.

- [x] **Step 1: Add command tests for unready rejection and owner-only ready start.** Create two players, verify start rejects while either is unready, set both ready, verify the owner starts, and verify the non-owner still cannot start. Assert game start sets each player's `isReady` back to false and preserves each `avatarId`.
- [x] **Step 2: Run the Spark suite and verify the start assertions after implementation; the final suite passed.**

Run: `npm.cmd run test:spark`

Expected: only a ready roster of 2–6 members starts, and readiness clears on start.

- [x] **Step 3: Harden `startGame`.** Retain the initial roster query to discover current document references. In the transaction, re-read the room, invite, and every discovered player document. Reject if the roster query size differs from the invite's current count, a player document disappeared, the count is outside 2–6, or any `isReady !== true`. Keep the invite and player reads in the same transaction as the status writes so concurrent join/leave/kick updates conflict or produce an explicit stale-roster rejection. Use a clear Thai error for unready players and a retry message for stale membership.
- [x] **Step 4: Clear readiness on start while preserving public identity.** When updating each player for game start, spread the current public record and set `isReady: false`; keep `avatarId` unchanged. Do not copy private cards to the public player document.
- [x] **Step 5: Update reset behavior.** When `resetGame` calls `makePlayer`, pass the existing player's name and avatar ID. `makePlayer` resets readiness to false and preserves a missing avatar as missing so legacy members continue to use the silhouette fallback.
- [x] **Step 6: Add a concurrency regression test.** Start an owner-ready room while a third unready member attempts to join. Assert the outcome is either a two-player game with the join rejected, or a three-player lobby with start rejected; never allow a playing room whose current roster contains an unready player. Also test a count-mismatched invite produces the actionable stale-roster failure.
- [x] **Step 7: Run the Spark suite.**

Run: `npm.cmd run test:spark`

Expected: every successful start has 2–6 ready members, non-owners cannot start, concurrent membership changes cannot bypass readiness, and reset clears readiness while retaining avatars.

## Task 4: Build and Review the Male SVG Avatar

**Files:**
- Create: `src/components/PlayerAvatar.tsx`
- Modify: `src/index.css`
- Modify: `tests/ui/preview.tsx`
- Modify: `tests/ui/verify.cjs`

**Interfaces:**
- Produce `PlayerAvatar({ avatarId, isReady, paletteIndex, seatDirection })`, with `avatarId` supporting `undefined` for the neutral legacy silhouette.
- Produce seat directions for `top`, `upper-right`, `lower-right`, `bottom`, `lower-left`, and `upper-left`.

- [x] **Step 1: Add an avatar preview scenario to the isolated UI harness.** Render the not-ready and ready male avatar side by side plus the legacy silhouette; use fixture-only data and no live Firestore connection.
- [x] **Step 2: Add UI assertions for the male avatar and pose groups.** Assert the preview exposes a male SVG with head, torso, and arm groups; readiness changes only its state class; the legacy value renders a neutral silhouette with no role text.
- [x] **Step 3: Draw the male avatar as inline grouped SVG.** Use a consistent `viewBox="0 0 180 220"`, with SVG groups for head/hair, torso, and each arm. Keep the SVG decorative with `aria-hidden="true"`; labels and status remain HTML. Add the ready state as a class/data attribute, not a second drawing.

```tsx
<svg viewBox="0 0 180 220" className={isReady ? 'player-avatar is-ready' : 'player-avatar'} aria-hidden="true">
  <g data-part="torso"><path d="M45 220v-54c0-20 19-35 45-35s45 15 45 35v54z" /></g>
  <g data-part="head"><circle cx="90" cy="62" r="34" /><path d="M56 58c2-27 20-43 39-43 21 0 34 17 35 41-12-6-20-15-25-25-12 15-29 24-49 27z" /></g>
  <g data-part="left-arm"><path d="M53 145c-14 12-22 31-24 52l29 6 17-44" /></g>
  <g data-part="right-arm"><path d="M127 145c14 12 22 31 24 52l-29 6-17-44" /></g>
</svg>
```

- [x] **Step 4: Run the UI harness and inspect the male preview at 390 px and 1440 px.**

Run terminal A: `npm.cmd run dev -- --config tests/ui/vite.config.ts`

Run terminal B: `node tests/ui/verify.cjs`

Expected: the SVG groups render without overflow and the ready state is distinguishable at both widths.

- [x] **Step 5: Present the male SVG preview to the user.** The user later explicitly requested completion of the full UI, so the matching female SVG proceeds in the same direction.

## Task 5: Add the Matching Female Avatar and Avatar Picker

**Files:**
- Modify: `src/components/PlayerAvatar.tsx`
- Create: `src/components/AvatarPicker.tsx`
- Modify: `src/index.css`
- Modify: `tests/ui/preview.tsx`
- Modify: `tests/ui/verify.cjs`

**Interfaces:**
- `AvatarPicker` exposes the selected `PlayerAvatarId` through `value` and `onChange` props.
- `PlayerAvatar` accepts both IDs and uses the same group names, viewBox, seat directions, and pose behavior.

- [x] **Step 1: Add preview assertions for the female avatar and the two accessible selection options.** The verifier checks keyboard selection, visible selected state, avatar groups and role-neutral labels; automated checks passed using temporary local Playwright tooling.
- [x] **Step 2: Add the female SVG using the male avatar's line weight, scale, palette treatment, and group structure.** Reuse the same ready and relaxed pose classes.
- [x] **Step 3: Implement `AvatarPicker` with two labeled buttons and an explicit selected state.** Keep the user choice in component state before room entry; disable create/join until a choice is selected. Include a visible instruction when no choice is selected and visible keyboard focus.
- [x] **Step 4: Add deterministic clothing color selection based on player ID.** Use a fixed six-color muted wardrobe palette; do not map a palette color to a role or readiness.
- [x] **Step 5: Review both SVGs together in the mobile UI preview.** Automated browser checks passed using temporary local Playwright tooling.

Run terminal A: `npm.cmd run dev -- --config tests/ui/vite.config.ts`

Run terminal B: `node tests/ui/verify.cjs`

Expected: both characters occupy the same viewBox, have matching poses, and retain clear silhouettes at lobby size.

## Task 6: Compose the Six-Seat Table and Connect the Real Lobby

**Files:**
- Create: `src/components/CouncilTable.tsx`
- Modify: `src/components/Lobby.tsx`
- Modify: `src/index.css`
- Modify: `tests/ui/firestore.ts`
- Modify: `tests/ui/roomCommands.ts`
- Modify: `tests/ui/preview.tsx`
- Modify: `tests/ui/verify.cjs`

**Interfaces:**
- `CouncilTable` receives `players`, `viewerUid`, `ownerUid`, `isProcessing`, `onReadyChange`, and `onKick`.
- `Lobby` calls `createRoom(user.name, avatarId, user.token)` and `joinRoom(code, user.name, avatarId, user.token)` through the active room-command path, preserving the current UID flow.
- The UI fixture command adapter exposes `setPlayerReady(isReady)` and emits updated public roster snapshots.

- [x] **Step 1: Extend the UI fixture with room scenarios for one, two, and six members.** Give each player an avatar ID and readiness value; include a legacy player without either optional field. Keep private hands separate from the public fixture.
- [x] **Step 2: Extend the fixture command adapter to capture avatar choices and readiness updates.** Creating/joining records the chosen avatar; `setPlayerReady` updates only the current fixture member's `isReady` value and emits a roster snapshot.
- [x] **Step 3: Add failing UI tests for seat assignment and public labels.** Assert exactly six seat positions, sorted roster IDs mapped from the top seat clockwise, empty seats labelled “ที่นั่งว่าง”, occupied players show names and ready text, the viewer shows “คุณ”, the owner marker follows the owner ID, and no coins or role cards appear. Cover viewer and owner readiness controls, disabled-start reasons, join/leave/kick roster updates, and invite counts in the command regression tests.
- [x] **Step 4: Implement `CouncilTable`.** Sort a copied player list by ID, map each occupant to the six fixed positions, and render remaining seats as placeholders. Keep status text and accessible icons outside the SVG. Put kick controls only on other members when the viewer is owner.
- [x] **Step 5: Integrate the table and controls into `Lobby`.** Add `AvatarPicker` before create/join; pass the selected ID into the create/join transactions. In an active room, show `CouncilTable`, the viewer's “พร้อมเล่น” / “ยกเลิกความพร้อม” control, owner start control with disabled reason, and leave control. Keep copy-code, kick, leave, owner transfer, join errors, and room limits unchanged.
- [x] **Step 6: Run the UI tests for the three roster sizes.**

Run terminal A: `npm.cmd run dev -- --config tests/ui/vite.config.ts`

Run terminal B: `node tests/ui/verify.cjs`

Expected: one, two, and six members render in deterministic seats; ready controls affect only the fixture member; owner controls remain available.

## Task 7: Add One-Shot Motion, Mobile Layout, Documentation, and Final Checks

**Files:**
- Modify: `src/components/CouncilTable.tsx`
- Modify: `src/components/PlayerAvatar.tsx`
- Modify: `src/index.css`
- Modify: `tests/ui/verify.cjs`
- Modify: `docs/ui-improvements.md`

- [x] **Step 1: Add pose transforms scoped to SVG groups.** Use seat-direction CSS variables to move the torso slightly inward and move the forward arm a few pixels when ready. Use a 180–240 ms one-shot transition; do not animate the whole table continuously.
- [x] **Step 2: Track readiness and roster transitions by player ID.** Initialize previous IDs/readiness from the first snapshot so unrelated snapshots do not replay entry or ready motion. Animate only a newly seen player for 160–220 ms. If ID sorting repositions existing members, update their positions immediately without animation.
- [x] **Step 3: Add the one-shot all-ready table edge highlight.** Trigger it only when the roster changes from not-all-ready to all-ready; stop after the brief highlight and do not restart it on unrelated snapshots.
- [x] **Step 4: Implement reduced-motion behavior.** Under `prefers-reduced-motion: reduce`, remove transforms and transition delays; switch pose, status, and color immediately.
- [x] **Step 5: Finish responsive layout and automated checks.** Keep all six seats represented on mobile with the compact table and six-row list; keep ready/start/leave controls reachable at 320 px and 390 px. Extend `fits()` in `tests/ui/verify.cjs` to include the table, seat list, and avatar elements. Emulate reduced motion both on and off and capture lobby screenshots at 320, 390, 768, and 1440 px.
- [x] **Step 6: Update `docs/ui-improvements.md`.** Record every changed file, avatar selection and readiness behavior, the public `avatarId` field, the narrow Firestore rule, deterministic seat ordering, and only the checks that actually passed. State that browser tests use the isolated fixture and no live multiplayer or production verification was performed.
- [x] **Step 7: Run the required quality checks.**

Run: `npm.cmd run lint`

Run: `npm.cmd run build`

Run: `npm.cmd run test:session`

Run: `npm.cmd run test:spark-engine`

Run: `npm.cmd run test:spark`

Run: `npm.cmd run test:rules`

Run the UI harness as specified in Task 6, then run `git diff --check`.

Expected: all applicable checks pass; no Firebase deployment, live project write, commit, push, or unrelated working-tree change occurs.
