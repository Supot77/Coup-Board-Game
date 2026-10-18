# Lobby Table and Player Avatar Design

> **Later user-approved revision, 2026-10-18:** The long front-facing table and 12-frame shadowed male/female sprite art supersede this document's round-table and grouped-SVG visual decisions. Six seats, deterministic ID ordering, public readiness and permissions remain as specified. Current implementation and verification are recorded in `docs/ui-improvements.md` and `output/avatar-motion-2026-10-18/README.md`. The original design below is retained as history.

Status: design and written spec were approved in chat; the implementation now includes both grouped avatar SVGs, the six-seat readiness table and the active Firestore readiness flow. The user instructed completion of the full UI after reviewing the male preview. Spark, Rules, and isolated browser suites passed using temporary local JDK/Playwright tooling; no live project was used.

## Goal and scope

Make the in-room COUP lobby table the main readiness interaction. A live roster occupies a reusable six-seat table, and each player chooses a role-neutral male or female avatar before creating or joining a room. The avatar changes pose from relaxed to slightly leaning toward the table when that player's real readiness state changes.

This design covers the lobby table, avatar selection, avatar rendering, and the readiness presentation and data needed by that interaction. It does not redesign the game board or create additional role portraits or screen backgrounds.

## Confirmed visual decisions

- Draw the table and six fixed chairs with SVG and CSS. Keep each chair as a stable seat position mapped from the live roster; do not bake people, labels, controls, or game state into a bitmap.
- Show occupied characters seated behind the table with their upper body and arms visible. Keep unoccupied seats visible as quiet placeholders labelled “ที่นั่งว่าง”.
- Offer two selectable, ordinary-player avatars: one male and one female. Use simple vector shapes and understated clothing that fits the Secret Council setting. Include no rank marks, role symbols, weapons, or props that could imply a hidden card.
- Build each avatar from grouped SVG elements for the head and hair, torso, and arms. Reuse those groups for both poses. Assign a muted clothing palette deterministically from the player's ID so all clients render the same player consistently; palette choice does not encode a role.
- The not-ready pose is relaxed, with the arms resting near the table. The ready pose leans slightly inward and moves an arm forward. Show explicit ready text and a check indicator alongside the pose.
- Keep the existing role portraits and background files separate from player avatars. The only new character artwork required for this lobby design is the two base SVG avatars; table, chairs, status marks, and motion are UI elements.

## Components and data flow

### Avatar selection

Add an AvatarPicker to the existing pre-room lobby. It presents the male and female SVG previews before the user creates or joins a room. The selected avatar ID is passed to the active createRoom or joinRoom transaction and stored on that player's public roster document as a validated avatar ID. The create/join transaction remains responsible for adding the player and keeping invite counts consistent.

An existing roster document is not rewritten when the same user re-enters a room. A player cannot edit avatar fields on an existing roster record. This keeps the Firestore self-update permission limited to readiness.

### Table and avatar rendering

Add a CouncilTable component that accepts the live roster, viewer ID, owner ID, and lobby callbacks. It sorts players by document ID in ascending lexical order and maps them to the fixed seats starting at the top and continuing clockwise. This produces the same layout on every client without adding a seat field. When roster changes reorder existing occupants, update their positions immediately; animate only the newly joined player. Preserve the current owner, kick, leave, and start permissions. Each occupied seat shows the player's name, a discreet “คุณ” marker for the viewer, an owner marker when applicable, and explicit ready/not-ready status. Do not show coins or role cards in the lobby.

Add a PlayerAvatar component that renders the selected SVG groups and takes the player's readiness and seat direction as inputs. Seat-specific transforms make characters lean inward while keeping every character upright. The component receives no private-hand data and never maps a role card to an avatar.

On narrow screens, keep the compact six-seat table and add a readable six-row seat list. Keep the viewer's ready control and the owner's start and leave controls visible and reachable.

### Readiness and start behavior

Use the public isReady boolean as the only readiness source. New room members start with isReady false; missing readiness on legacy records is treated as false. Each member toggles only their own readiness while the room is in a live lobby. The Firestore rule permits only that field change by that member in a lobby; all other player fields remain host-controlled.

The room owner can start only with 2–6 current members and when all current members are ready. The UI states a plain reason when start is disabled. The final start transaction re-reads the invite and all current player records and rejects a stale, incomplete, or unready roster with an actionable message. Starting or resetting a game clears readiness to false while preserving each player's avatar ID.

If a roster record predates avatar selection and has no avatar ID, show a neutral ink silhouette. Do not infer a gender or role from legacy data. A newly created or joined roster record stores a validated male or female avatar ID.

## Motion and accessibility

- Settle the table and chair positions once after room creation; fade and move the owner into their chair by a few pixels.
- Animate only the newly joined player's seat on join, with a short opacity and vertical transition of about 160–220 ms. If deterministic ID sorting changes an existing player's seat, reposition that player immediately without animation.
- Animate the avatar's ready pose with a short one-shot transition of about 180–240 ms. Do not replay it for unrelated Firestore snapshots.
- When everyone in the current roster is ready, show one restrained teal highlight around the table edge and stop.
- Respect prefers-reduced-motion by switching pose, color, and status immediately without movement.

## Expected code boundaries

- src/components/Lobby.tsx: avatar choice, live roster wiring, readiness and owner actions.
- src/components/AvatarPicker.tsx: the two role-neutral avatar choices.
- src/components/CouncilTable.tsx: six stable seats, occupied and empty seat presentation.
- src/components/PlayerAvatar.tsx: grouped SVG drawing and readiness pose.
- src/index.css: palette, layout, responsive behavior, focus states, and one-shot motion.
- src/core/roomCommands.ts and src/core/gameEngine.ts: validated avatar IDs, initialization, readiness transactions, authoritative start checks, and reset behavior.
- src/types.ts: public avatar and readiness fields.
- firestore.rules: validated avatar field on player creation and narrow self-readiness updates during lobby only.
- tests/ui and tests/rules: fixtures and coverage for selection, roster mapping, readiness, permissions, start conditions, and reset behavior.
- docs/ui-improvements.md: implementation files, visible behavior, data/rule changes, and verified checks after implementation.

## Verification requirements

- Add UI fixture coverage for one-, two-, and six-player lobbies, both avatar choices, stable palette rendering across clients, the legacy silhouette fallback, ready/not-ready poses, owner/member controls, and join/leave/kick roster updates.
- Add Firestore rules coverage proving that a member can update only their own isReady in a lobby; outsiders, edits to another member, edits to other player fields, and readiness edits after start fail.
- Add command coverage for unready start rejection, owner start after all current members are ready, non-owner rejection, stale-roster rejection, and readiness reset while preserving avatars.
- Check reduced motion on and off, six-seat placement, and mobile widths from 320 to 390 px. Verify names and controls do not overlap or overflow.
- Run npm.cmd run lint, npm.cmd run build, and the relevant session, Spark engine/command, Firestore rules, and UI checks documented in docs/ui-improvements.md. Do not deploy or write to a live Firebase project.

## Asset inventory

Already present in public: the five role portraits and BG-LOGIN.png, BG-BOARD.png, and BG-LOBBY.png. Existing lower-case JPGs and other assets are left untouched. This design requires two new grouped SVG avatar illustrations, created one at a time in a shared style: male first, review it, then create the female version to match. It does not require a new generated table image, a new lobby background, or separate ready and not-ready bitmap files.

## Acceptance criteria

1. A player chooses a role-neutral male or female avatar before creating or joining a room, and all clients render that saved avatar consistently.
2. The lobby always has six fixed seat positions; occupants are sorted by player document ID and mapped from the top seat clockwise, while the live roster determines the player count.
3. Each player's actual readiness controls the pose, text, and icon. No avatar reveals or suggests private cards.
4. The ready action, start authorization, stale-roster checks, Firestore rules, and reset behavior follow the active src/core command path.
5. Motion is short, one-shot, responsive, and immediate under reduced-motion preference.
6. The empty and populated lobby remain readable on 320–390 px mobile widths and satisfy the verification requirements above.
