# The Secret Council UI Refresh Plan

> **Later visual revision:** The in-room lobby now uses a long front-facing table and shadowed male/female 12-frame sprite animation, at the user's request. See `output/avatar-motion-2026-10-18/README.md` for the integration and current checks; the initial plan below is retained as implementation history.

> **Status:** Complete. The matching female avatar, game UI refresh, six-seat readiness table, and verification are finished. Keep the detailed implementation record in [`2026-10-18-lobby-avatar-table.md`](2026-10-18-lobby-avatar-table.md).

**Goal:** Finish the responsive COUP UI refresh as a working game interface while preserving the existing Firebase/session architecture, real game rules, privacy boundaries and user changes.

**Architecture:** React components own live text and interaction; CSS/SVG own the table, chairs, cards, frames, status marks and motion; bitmap art is limited to the existing backgrounds and role portraits. Active room and game commands remain in `src/core`; the room host continues to process game commands.

**Visual source:** `output/ui-secret-council-2026-10-17/build-command-pack.md`, plus the user-provided `AGENTS.md` instructions. Use `public/img/{DUKE,ASSASSIN,CAPTAIN,AMBASSADOR,CONTESSA}.png` for role portrait art. Keep labels, card frames, rules and live state in the DOM/CSS/SVG.

## Guardrails

- Preserve all existing working-tree changes. Do not reset, clean, overwrite or reformat unrelated work.
- Keep the existing room/session, private-hand, command, host-processor and game-engine flows. Do not add functionality only under `functions/src` or change deployment configuration.
- Do not send or render opponents' hidden roles. Face-down cards always use the shared card back; reveal only cards already public in game state.
- Keep the fixed six-chair lobby and readiness rules from the detailed lobby plan, including deterministic ID order, Firestore self-readiness rules and authoritative ready-only start transaction.
- Do not deploy, write to a live Firebase project, commit or push.

## Execution order

### Task 1: Establish the shared visual system and card primitive

Files: `src/index.css`, `src/components/PlayingCard.tsx` (new), `src/components/PlayerActionPanel.tsx`, `src/components/OpponentList.tsx`.

- [x] Replace the current casino-purple/gold theme tokens with the approved paper, ink, vermilion, teal, lilac and brass palette. Add restrained Thai/display/mono font stacks with system fallbacks.
- [x] Add shared button, surface, focus, divider and status styles. Keep visible keyboard focus, readable contrast, 44px touch controls and reduced-motion support.
- [x] Build one reusable card front using the confirmed role PNG portraits, HTML role labels and a CSS/SVG frame. Add a single reusable symmetric card back in SVG/CSS.
- [x] Support own hand, selected Exchange card, revealed/dead card and face-down opponent states without moving game logic into the component. Keep hidden opponents on the card back and do not load their portrait.
- [x] Run `npm.cmd run build` and `npm.cmd run lint`; inspect card states in the isolated UI harness. The automated Playwright suite passed with temporary local tooling.

### Task 2: Refresh login and pre-room lobby

Files: `src/components/Login.tsx`, `src/components/Lobby.tsx`, `src/index.css`, UI fixtures.

- [x] Restyle entry screens around the approved paper palette and existing `BG-LOGIN.png` / paper treatment. Keep the existing login/session behavior, accessible labels and rules access.
- [x] Keep create/join controls, room-code validation and errors intact. Add accessible male/female avatar selection before room entry and pass the chosen ID to the active room commands.
- [x] Verify keyboard flow, loading/disabled states, code normalization and narrow layouts in the isolated preview. The automated browser suite passed with temporary local tooling.

### Task 3: Implement lobby roster/readiness data and permissions

Files: `src/types.ts`, `src/core/gameEngine.ts`, `src/core/roomCommands.ts`, `firestore.rules`, Spark and Rules tests.

- [x] Follow Tasks 1–3 of the detailed lobby plan: store validated avatar IDs and initial `isReady: false`; implement the narrow own-readiness transaction/rule; make start validation transactional and ready-only; preserve avatars and clear readiness on start/reset.
- [x] Cover joins, leaves, kicks, owner transfer, invite counts, stale rosters and legacy readiness/avatar records in command/rules tests.
- [x] Run `npm.cmd run test:spark` and `npm.cmd run test:rules`; both passed (6 tests each) with a temporary portable JDK 21.

### Task 4: Create and review the male player avatar

Files: `src/components/PlayerAvatar.tsx`, `src/index.css`, isolated UI preview/tests.

- [x] Create the role-neutral male seated SVG from grouped parts with relaxed and ready poses, plus the neutral legacy silhouette fallback.
- [x] Preview at mobile and desktop sizes and show the male SVG to the user. The user then instructed completion of the full UI, so the matching female design was completed.

### Task 5: Build the six-seat readiness table

Files: `src/components/AvatarPicker.tsx`, `src/components/CouncilTable.tsx`, `src/components/Lobby.tsx`, UI fixtures/tests.

- [x] Follow Tasks 5–7 of the detailed lobby plan: add the female avatar, deterministic clothing palette, six fixed seats sorted by document ID, occupancy/empty-seat labels, viewer/owner markers, ready status and owner controls.
- [x] Add one-shot join/ready/all-ready motion and immediate reduced-motion state changes. On mobile retain both the compact table and six readable seat rows, with ready/start/leave controls reachable.
- [x] Verify 1-, 2- and 6-player fixtures, owner/member behavior, kick/leave/join changes, 320px and 390px widths, and reduced motion on/off. The automated UI suite and manual 768/1440px table inspections passed.

### Task 6: Apply the visual system to the live game board

Files: `src/components/GameBoard.tsx`, `src/components/PlayerActionPanel.tsx`, `src/components/OpponentList.tsx`, `src/components/ActionLog.tsx`, `src/index.css`, UI fixtures/tests.

- [x] Restyle the board around the council table and readable event/action hierarchy. Use the existing board art only as a quiet subordinate layer; keep the event area uncluttered.
- [x] Use the reusable card component for own hand, revealed opponent influence and Exchange selection. Preserve live card privacy, valid card counts, role challenge/block availability, action costs, response countdown and elapsed-game timer.
- [x] Keep all seven actions, forced Coup, target selection, response, block, discard, Exchange, pass consequences, logs, elimination and victory behavior tied to the existing game engine and commands.
- [x] Verify the board at desktop, tablet and 320–390px mobile widths; inspect for overlap and horizontal overflow. The UI suite passed at all target viewports.

### Task 7: Refresh rules, tutorial, dialogs and victory

Files: `src/components/RulesModal.tsx`, `src/components/Tutorial.tsx`, `src/components/VictoryScreen.tsx`, dialog components, `src/index.css`.

- [x] Apply the shared paper/ink system to rules, six-step tutorial, confirmations/notices and victory modal without changing their content or game outcomes.
- [x] Preserve modal focus, Escape/backdrop dismissal, independent scrolling, tutorial state and close/reopen behavior. Keep celebratory motion brief and honor reduced motion.
- [x] Check at phone and desktop sizes for readable Thai, clear hierarchy and no clipping. Mobile/tablet rules screenshots and the responsive UI suite passed.

### Task 8: Final verification and documentation

Files: all changed files, `tests/ui/firestore.ts`, `tests/ui/roomCommands.ts`, `tests/ui/preview.tsx`, `tests/ui/verify.cjs`, `docs/ui-improvements.md`.

- [x] Run `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run test:session`, `npm.cmd run test:spark-engine`, `npm.cmd run test:spark` and `npm.cmd run test:rules`. All passed, including both emulator suites.
- [x] Run the isolated Vite UI harness and browser verifier; cover 1/2/6-player lobby, readiness, stale start, card states, game-board flows, 320/390/768/1440px and reduced motion on/off. The automated suite passed using a temporary local Playwright install.
- [x] Inspect screenshots, correct text collisions/overflow, then run `git diff --check`. Manual screenshots were inspected and the diff check passed.
- [x] Update `docs/ui-improvements.md` with actual files, behavior, readiness/security/card changes and checks that passed. State clearly that no live project or physical device was tested if applicable.
- [x] Confirm the original unrelated `.firebase/hosting.ZGlzdA.cache` change and existing assets remain intact. No commit, push or deployment was made.
