# Secret Council gameplay UX implementation plan

> Execute inline in the current user-authorized workspace. The user approved review items 1–7 and excluded invitation links/QR (item 8). Do not commit, push or deploy.

**Goal:** Keep decisions reachable, expose public table context, confirm irreversible selections, add restrained feedback, persist round history, and share response deadlines.

**Architecture:** Keep the existing Firestore transaction engine and creator-host command processor. Store immutable, public-only events in `rooms/{code}/events`, filtered by `roundId`; persist server-stamped response windows on the room. Build focused React components for table context, response decisions, feedback/preferences and event history.

**Tech stack:** Existing React/TypeScript, CSS/SVG, Firebase client transactions, Node tests, Firestore/Auth emulators and isolated Chromium fixtures. No additional production dependencies.

**Spec:** User-approved items 1–7 in this conversation, root AGENTS.md, and the Secret Council command pack. Later room settings (15/30/45/60 seconds) supersede the original fixed timeout.

## Constraints
- Preserve the initial `.firebase/hosting.ZGlzdA.cache` change and review artifacts.
- Keep 2–6 players, all seven actions, real bluffing, private hands and existing lobby/reset permissions.
- No invitation-link/QR work. No `functions/src` or Firebase deployment configuration changes.
- Expiry and host availability remain foreground browser best effort on Spark; never describe them as server execution.
- No synthetic history, statistics, optimistic outcome animations or inferred secret cards.

## Task 1: Shared response windows and durable public events
Files: `src/core/responseTiming.ts`, `gameEngine.ts`, `gameEvents.ts`, `hostCommandProcessor.ts`, `gameCommands.ts`, `roomCommands.ts`, `roomMaintenance.ts`, `firestore.rules`; related engine/command/rules tests.
Interfaces: `responseDeadlineMillis(room)`, `getResponseSecondsLeft(room, now)`, `PublicGameEvent`, `buildPublicGameEvent(before, after, actorId, command)`, `summarizeRound(events)`.
- [x] Add tests that two readers/reloads use the same deadline, stale-window responses fail, early/member expiry fails and expired host resolution preserves game rules.
- [x] Add tests for public event allowlists, proof outcomes, round separation, idempotency and member/outsider permissions. Example: `assert.equal(JSON.stringify(event).includes('exchangeOptions'), false)`; `assert.equal(eventsAfterRetry.length, eventsBeforeRetry.length)`.
- [x] Add server-stamped windows, host expiry/presence, immutable events in the command transaction and initial round event. Reset clears current-round fields and cleanup deletes event documents.
- [x] Run engine tests and both emulator suites.

## Task 2: Public table overview and connection/command status
Files: `GameBoard.tsx`, `TableOverview.tsx`, `OpponentList.tsx`, `gameCommands.ts`, `src/types.ts`.
- [x] Subscribe to current-round events; keep legacy latest-message fallback explicitly partial.
- [x] Render public avatars/coins/influence in actual turn order, current/next player, target and unanswered responders in a compact rail available on every mobile tab.
- [x] Show sending/received/waiting/offline status accurately; wait for a queued command without sending a duplicate. Countdown reads the room deadline and never starts a new local response window.
- [x] Verify snapshot/reconnect and no private role art in the public overview.

## Task 3: Reachable decisions, confirmations and saved density
Files: `PlayerActionPanel.tsx`, new `ResponseDecision.tsx`, `Modal.tsx`, scoped gameplay CSS.
- [x] Keep event summary/countdown and legal response controls in fixed modal rows; scroll illustration, advice and private-card peek independently.
- [x] Move targeted-action confirmation after target selection; show exact target/cost/consequence and back/cancel. Select then explicitly confirm a discard.
- [x] Save detailed/compact action preference; keep role/bluff markers and all legal actions visible in either mode.
- [x] Update UI tests for final confirmations and ensure stale selections cannot submit after turn/phase changes. Test controls at 320×568 without scrolling, including four Steal responses and keyboard focus.

## Task 4: Confirmed-result feedback, sound and round summary
Files: `GameFeedback.tsx`, `gameAudio.ts`, `PlayingCard.tsx`, `VictoryScreen.tsx`, `ActionLog.tsx`, gameplay CSS.
- [x] Animate confirmed event deltas only; preserve static result text and reduced-motion behavior. No initial-load/reconnect effect replay.
- [x] Add opt-in synthesized coin/card/turn sounds with persisted mute/volume. Unlock audio only after user interaction; no external audio dependency.
- [x] Render persistent structured history with actor filtering and non-disruptive new-event navigation. Add actual duration, turns, successful challenges and latest public events to victory.
- [x] Verify empty/legacy states and close/reopen/rematch semantics.

## Task 5: Regression, rendered review and documentation
Files: fixture adapters and targeted `tests/ui/verify-gameplay-ux.cjs`, existing UI scripts where interaction changed; `docs/ui-improvements.md`.
- [x] Run lint, TypeScript, build, session, engine, Spark, Rules and relevant existing UI suites.
- [x] Capture/inspect desktop and 320/360/390 px mobile gameplay, response, targeting, discard, history, summary and reduced-motion states. Recheck 1/2/6-seat lobbies and roster/readiness behavior.
- [x] Record changed files, public schema/Rules/expiry limitations and exact verification evidence in project docs. Leave all implementation uncommitted and undeployed.

## Completion evidence

All five tasks completed locally. See `docs/ui-improvements.md`, section 30, for exact checks, screenshots and execution limits. No commit, push or deployment was performed.
