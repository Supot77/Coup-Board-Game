# COUP UI implementation instructions

These instructions describe the user-requested UI refresh for this repository. The approved visual and interaction plan is in [the Secret Council UI command pack](output/ui-secret-council-2026-10-17/build-command-pack.md). Read it before changing the interface; this file narrows the implementation priorities and resolves the lobby-readiness behavior.

## Start from the current workspace

1. Read this file, `docs/ui-improvements.md`, the command pack above, and the relevant source files before editing. At minimum inspect `src/App.tsx`, `src/components/Login.tsx`, `Lobby.tsx`, `GameBoard.tsx`, `PlayerActionPanel.tsx`, `OpponentList.tsx`, `ActionLog.tsx`, `RulesModal.tsx`, `Tutorial.tsx`, `VictoryScreen.tsx`, `src/index.css`, `src/core/gameEngine.ts`, `src/core/roomCommands.ts`, `src/core/gameCommands.ts`, `src/core/hostCommandProcessor.ts`, `src/types.ts`, `firestore.rules`, and the related tests.
2. Inspect `git status` first. This workspace may contain existing user changes. Keep them. Do not reset, checkout, clean, overwrite, or reformat unrelated work.
3. Follow the active architecture documented in `docs/ui-improvements.md`: room and game commands currently use Firestore transactions in `src/core`; during a game the room creator processes game commands through `hostCommandProcessor.ts`. The `functions/src` tree is legacy and is not deployed by the current Firebase configuration. Do not add a feature only to that unused tree or change deployment configuration.
4. Reconcile any mismatch between the plan and current code by treating code, rules, tests, and the current user request as authoritative. The generated concept images are visual references, not a source for game rules, copy, room codes, player counts, or hidden information.

## Goal

Refresh the game UI to the “The Secret Council” look while preserving real gameplay and making the lobby table and readiness state the signature interaction. Implement the working UI, not a static screenshot. Use HTML, CSS, and SVG for layout, chairs, cards, controls, and status indicators. The user subsequently approved a decorative long-table illustration and shadowed male/female frame-by-frame avatar art; keep occupants, labels, controls, and readiness separate from the tabletop bitmap.

## Visual direction

- Use warm paper `#F2EBDD`, light paper `#FFF9EE`, deep ink `#102735`, soft ink `#274253`, vermilion `#B6322C`, teal `#3E918A`, muted lilac `#A687B0`, coin brass `#D2AA68`, and rule line `#C9BBA6`.
- Pair a restrained display serif for the COUP wordmark/headings with a legible Thai sans-serif for controls and body copy. Use a mono face for room codes and numeric status when available; keep usable system fallbacks.
- Use a small number of clean woodcut/editorial portraits, simple card frames, thin rules, quiet shadows, and a faint paper surface. Do not fill every surface with engraving, ornate borders, palace scenes, fake parchment marks, or glow.
- Keep decorative art subordinate to readable game information. Do not bake labels or live UI into generated images. Do not generate a unique background for every screen. Prefer one reusable entry illustration, one very subtle board illustration, and shared role portraits; use CSS/SVG for everything that changes with game state.
- Do not expose opponent role art for face-down influence. Avatar choices and readiness poses must not reveal or suggest a player's cards.

## Lobby table and readiness behavior

This is the main new interaction requested by the user.

### Table layout

- Show exactly six fixed seat positions across the far side of a long council table on desktop, even when fewer than six players are present. All occupants face the viewer so everyone can see the approved readiness animation. This user-approved revision supersedes the original round-table concept. The decorative tabletop is reusable art; live seats and occupants remain DOM/CSS/SVG components.
- Populate occupied chairs from the live room roster. Each occupied seat shows the display name, a discreet “คุณ” marker for the viewer, an owner marker for the room owner, and explicit ready/not-ready text and icon. Do not show game coins or role cards in the pre-game lobby.
- Keep unoccupied chairs visible as quiet placeholders labelled “ที่นั่งว่าง”. The player count reflects the roster, not the number of chairs.
- At compact widths, preserve the six-seat model in two rows of three front-facing occupants with a readable six-row seat list. Keep the mobile readiness control reachable while viewing the animation, and retain owner start/leave controls.
- Retain the current room code behavior: eight allowed uppercase letters from `A-H, J-N, P-Z`, excluding `I` and `O`. Keep copy-code, join errors, kick permissions, leave, and owner transfer behavior intact.

### Ready state and start rule

- Each occupied player, including the room owner, can toggle their own readiness. Use “พร้อมเล่น” and “ยกเลิกความพร้อม” actions. Show each player's status to the room.
- New room members start with `isReady: false`. Missing readiness on an existing player is treated as not ready. Joining, leaving, kicking, or changing owner must leave the roster and readiness view consistent.
- The room owner alone can start. For this plan, enable start only when there are at least two and at most six members and every current member is ready. The room does not need all six chairs filled. Show a plain reason when start is disabled, such as “รอผู้เล่นทุกคนกดพร้อม”.
- Starting a game or resetting to the lobby clears readiness to false, so every player confirms for the next round. Handle concurrent roster/readiness changes safely: the final start transaction re-reads the invite and all current player records and rejects a stale or not-ready roster with an actionable message.
- Do not fake readiness with component-local state. Store the public boolean on the player's public roster document. A player may change only their own `isReady` while that room is in a live lobby. Update `firestore.rules` to allow only that narrow field change by that member in the lobby; keep all other player fields host-controlled and keep private card data private. Implement the transaction in the active `src/core/roomCommands.ts` path and make start validation use the same authoritative transaction path.
- Update the existing UI Firestore fixture and tests to model readiness. Add coverage that a member can toggle only their own ready state in a lobby; outsiders, other-member edits, non-readiness field edits, and ready changes after start are rejected; an unready roster cannot start; the owner can start after all current members are ready; a non-owner still cannot start; readiness clears on reset. Keep invite player counts correct during joins/leaves/kicks.
- Do not implement readiness in `functions/src/index.ts` alone. Do not weaken Firestore rules broadly to make a UI toggle work.

### Lobby motion

Use calm one-shot feedback. Motion should explain a state change, not keep the table alive artificially.

- After room creation, settle the table and six chair positions once; the owner appears in their chair with a short fade and a few pixels of movement.
- When someone joins, animate only that seat once (about 160–220 ms, small opacity/vertical transition).
- Toggling ready plays the approved shadowed male/female sprite art from relaxed to slightly leaning toward the table: twelve frames at 24fps, then stop. Reverse from the current frame when readiness is cancelled, initialize at the current endpoint for an existing roster, and pair the pose with explicit text and icon. Use the neutral silhouette for legacy/missing or failed avatar art. Fixed dark clothing replaces the initial automatic-color concept.
- When all current players are ready, give the table edge one restrained teal highlight, then stop. Do not pulse forever.
- Do not use realistic character rigging, repeated bouncing, shaking, flashing, or motion that delays input. Respect `prefers-reduced-motion`; when enabled, replace movement with an immediate state and color change.

## Preserve game behavior

Use `src/core/gameEngine.ts` and the active command flow as the source of truth. Keep the current session, Firebase, permissions, host-command processing, private-hand reads, and responsive behaviors intact. Do not reimplement game rules in visual components.

Keep these requirements visible and correct:

- Two to six players. A player starts with two influence and two coins; the deck has three copies of each of the five roles.
- Show seven actions: Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange. Contessa is a defensive role, not an action.
- Income gives one coin; Foreign Aid gives two; Tax gives three; Coup costs seven; Assassinate costs three; Steal transfers up to two; Exchange draws two and keeps the same number of living cards.
- At ten or more coins, Coup is mandatory. Assassination cost remains paid if its block is accepted.
- Only reveal opponents' lost cards. Never send or render private hands as public roster data.
- Only offer legal challenges and blocks for the current response state. Foreign Aid can be blocked by a claimed Duke but cannot itself be challenged. Coup and Income cannot be blocked or challenged. Targeted block rules and the 15-second response behavior remain as implemented.
- Distinguish elapsed game time from response countdown. Keep pass consequences, discard consequences, Exchange selection count, elimination and victory states accurate.

## Screen scope and implementation order

Implement in this order so the core direction lands early:

1. Shared design tokens, typography, buttons, surfaces, focus states, and reusable card/role/status primitives.
2. Login and the pre-room lobby (create/join).
3. In-room six-chair lobby with live roster, ready toggle, owner actions, empty seats, loading/error/disabled states, and restrained motion.
4. Main game board, opponent list, private hand, action selection/targeting, response and block states, reveal and Exchange states, and action history.
5. Rules, six-step tutorial, victory modal, and responsive mobile navigation.

Reuse existing components where that keeps behavior intact; split components where the table/readiness flow needs a clear boundary. Do not turn the whole game into one static image or one oversized component.

## Verification and documentation

- Run the repo's relevant existing checks after implementation: `npm.cmd run lint`, `npm.cmd run build`, and the relevant session, Spark engine/command, Firestore rules, and UI checks. Use the established test scripts and the commands documented in `docs/ui-improvements.md`. Do not deploy Firebase or write to a live project.
- Check lobby animations with reduced motion on and off, readiness as owner/member, 1/2/6-player room states, join/leave/kick, stale start attempts, and mobile widths from 320 to 390 px. Check the game board at desktop and mobile widths and inspect screenshots for text overlap/overflow.
- Update `docs/ui-improvements.md` with the changed files, visible behavior, new readiness data/rule behavior, and verification results. Keep the documentation accurate; do not claim production or physical-device verification that was not performed.
- Do not commit, push, deploy, or discard existing changes unless the user separately asks.
