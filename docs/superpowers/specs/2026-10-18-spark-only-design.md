# Spark-Only Coup Security and Session Design

**Status:** Implemented and deployed to `coup-49ffc` on 2026-10-18
**Billing constraint:** Firebase Spark only. Do not start a trial, link a Cloud Billing account, enable paid services, or incur charges.

## Goal

Keep the Coup app usable without billing while stopping unauthenticated visitors from reading or changing Firestore data, keeping private cards hidden from other ordinary room members, requiring a fresh in-app login after 30 minutes of inactivity, and cleaning up idle lobbies when an app client is online.

## Important limits

Firebase Spark cannot deploy Cloud Functions, Cloud Scheduler jobs, or Firestore TTL policies. Without a trusted server, the app cannot reliably enforce game rules, generate a fair hidden deck, expire a session against a modified client, or delete a room while every browser is offline.

The Spark-only version therefore protects against unauthenticated visitors and casual access across rooms. Anonymous Auth is easy to create, so it does not prevent determined users from making multiple guest accounts. New room codes will use eight random characters rather than the current four, to make guessing harder; a code is still an invitation, not identity verification. The design does not protect a room from a malicious member or room creator. The room creator's browser must initialize and maintain canonical game state, including the deck and all dealt cards, so that creator can inspect or alter hidden state. Client-side 30-minute timeout and lobby cleanup are best-effort behavior, not server-enforced security guarantees.

## Selected architecture

Use Firebase Anonymous Authentication and the Firestore client SDK only. Remove the deployed app's dependency on callable Functions. An authenticated user entering a known eight-character code can read only a minimal `roomInvites/{code}` document needed to join; room listings remain disabled. After joining, members read public snapshots and create immutable action requests. The room creator's active client validates and applies requests using the shared Coup transition engine, writes a result for the author, and removes the processed request. Firestore transactions prevent accidental concurrent overwrites, and Security Rules limit access to authenticated room members, the room creator, and each player's own private snapshot.

New rooms use `schemaVersion: 3`. Membership changes update the invite count and player documents atomically; the known invite code does not reveal player names or IDs.

The browser session lock remains a 30-minute inactivity timer with a warning at minute 29. It blocks the UI until the player deliberately logs in again, while keeping the anonymous Auth UID so the player can resume their room. Waiting for another player's decision may pause the local timer, matching the existing experience, but this state is not authoritative.

An online room client checks the lobby's `lastActivityAt` once per minute. If a lobby has been idle for 30 minutes, a member can remove its room, roster, private-player, internal-state, command, and command-result documents. A member who reopens their saved room can trigger the same cleanup after returning. If every browser stays closed, deletion waits until a member returns with the room code.

## Data access boundaries

- `rooms/{roomCode}` holds public room and game state, a room creator UID, status, revision, and activity timestamp. It contains no unrevealed card faces. Only the room creator writes gameplay state; members may refresh lobby activity when joining/leaving through approved transitions.
- `roomInvites/{roomCode}` holds only the schema, lobby/game status, and player count. Authenticated users may get a known code to join, but cannot list invite documents.
- `rooms/{roomCode}/players/{uid}` holds the public roster. Room members may read it; a player can create or remove their own lobby record, while the room creator writes game-state changes and removes other players.
- `rooms/{roomCode}/privatePlayers/{uid}` holds a player's unrevealed hand. The owner may read their own document. The room creator's browser may read and write all private-player documents to deal and process the game, and is consequently trusted with every hand.
- `rooms/{roomCode}/commands/{commandId}` contains immutable action requests authored by a room member. The room creator reads and processes requests, then deletes each after saving its result.
- `rooms/{roomCode}/commandResults/{commandId}` contains the host-written result for a request. The author and room creator may read it; only the creator may write it.
- `rooms/{roomCode}/internal/state` holds the deck and hidden state. Only the room creator may access it. Since the creator is a player, this data is visible to that player.
- `rooms/{roomCode}/cleanupMarkers/{uid}` lets a member resume an already-closed idle-lobby cleanup after partial deletion.
- `sessions/{uid}` is removed from the authorization model. The inactivity timer and active flag live in browser storage and cannot be server-enforced on Spark. No unmatched or legacy paths are readable or writable.

Rules enforce authentication, minimal lookup for a known invite code, deny invite and room listings, require membership for ongoing snapshots, protect private documents by owner, limit gameplay-state writes to the room creator, validate command authorship and document shape, and check membership/capacity. Rules do not claim to prove the legality or fairness of a game transition. Existing legacy room documents are not migrated or deleted and remain inaccessible under the new rules. New rooms use eight-character codes; legacy rooms are not migrated.

## Failure behavior

- If the creator closes the browser, new action requests wait until the creator returns. Show a clear pending-host message; do not accept direct member writes to game state as a fallback.
- If the creator is idle-locked, they must log in again before the client processes room actions.
- If an action request is malformed or no longer legal, the creator rejects it by writing a command result without changing the room revision.
- If a transaction conflicts, retry from the newest revision; command IDs make repeated processing idempotent.
- If Firestore reaches Spark's free quota, database operations may stop for the remainder of the quota interval. Do not add a paid fallback.
- If cleanup cannot complete because a client disconnects, keep the room marked closed and retry when a room member returns. Returning from a finished game to the lobby begins a fresh 30-minute inactivity window.

## Deployment

Anonymous Auth is already enabled and the separate unused Realtime Database already has deny-all rules. Deploy the new Firestore Rules before the matching Hosting client so the legacy public client loses access immediately; this creates a short unavailable window while the new client is deployed. Do not deploy Functions, Scheduler jobs, Firestore TTL, or billing changes. Do not delete legacy room data during rollout.

Deployment completed on 2026-10-18. Firestore Rules and Hosting were the only deployed targets. Firebase CLI reported the Firestore database `freeTier: true`. A production smoke test used two temporary anonymous accounts, verified the room/game/privacy path and idle cleanup, then deleted the test room and both accounts. No billing or trial action was taken.

## Verification

- Unit-test the 30-minute local session timer, warning, explicit re-login gate, and waiting-state pause.
- Firestore Rules Emulator tests must prove that unauthenticated users, nonmembers, non-owner private-card readers, and non-host state writers are denied; authenticated users can get minimal invite metadata by known code but cannot list invites; valid members can read public room state and submit their own command; the host can process commands; legacy documents remain denied.
- Emulator integration tests must cover two anonymous players creating/joining a room, host dealing and processing a legal action, rejecting an illegal action, private-card boundaries, and cleanup while a client is active.
- Run build, TypeScript, lint, Rules tests, session tests, and the UI fixture. Include room-code length/normalization and retryable cleanup cases. Deploy Rules and Hosting only after all checks pass, then verify the live room flow and denied cross-room/private reads.

## Acceptance criteria

- No unauthenticated visitor can read or write application data.
- A nonmember cannot read a room roster or private card; a member cannot read another player's private document.
- Only the room creator's client can update canonical room, player, private-player, and internal game state. Other members can only create their own action requests and read their own action results.
- The app UI requires deliberate in-app login again after 30 idle minutes, with a one-minute warning; a modified client can bypass this check.
- New rooms use eight-character random invite codes; lookups cannot enumerate a room or invite collection.
- An idle lobby is deleted after 30 minutes while at least one member's foreground client remains active; if all clients are offline, it is removed when a member returns with its room code.
- All Firebase resources used remain within Spark's no-cost products and quotas; no Cloud Billing account is linked.
- The UI and documentation clearly disclose that the room creator can inspect/alter hidden game state and that the timeout and cleanup are client-enforced.

## References

- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans): Spark and Blaze capabilities and quotas.
- [Cloud Functions deployment requirements](https://firebase.google.com/docs/functions/get-started): deploying Functions requires Blaze.
- [Firestore quotas and limits](https://firebase.google.com/docs/firestore/quotas): TTL deletes do not have free usage.
