# Male and female lobby avatar motion prototypes

Status: the user approved the male/female direction and requested lobby integration with a long table. Both sprite sheets and the generated table are now consumed by the real lobby components; the standalone preview remains as the artwork prototype.

- `male-ready-sprite-draft.png`: generated with built-in imagegen. Twelve frames, four columns by three rows; 1448×1086 pixels, 362×362 per cell. RGBA transparency verified by metadata and sampled pixels.
- `female-ready-sprite-draft.png`: matching female companion, generated with the male sheet as the style, shadow, grid and pose reference. Same dimensions and grid; RGBA transparency verified by metadata and sampled pixels. The user approved the male direction before requesting this companion.
- `male-ready-preview.html`: includes male/female selection and plays forward/reverse at 24 frames per second, stops at either endpoint, and jumps to the endpoint with reduced motion. Switching character resets to the relaxed pose. Uses CSS sprite positioning; it does not alter the generated pixels.
- Style reference: `public/img/DUKE.png`. The reference supplies ink contours, hatching and palette, not the Duke's identity or role-specific props.
- Requested direction: ordinary male attendee in a simple navy jacket; anonymous face in shadow; adult proportions; transparent background; relaxed-to-ready seated transition.
- Review limitations: generation has not yet been validated for pixel registration, stable anatomy or smooth motion. The preview exposes those issues before production integration.
- The female generation prompt is recorded verbatim in `female-generation-prompt.md`.
- Browser verification: female selection rendered correctly; ready reached frame 12 and reverse reached frame 1. A full-page screenshot is saved as `female-ready-preview.png`. This verifies endpoint playback, not perceived smoothness or anatomical continuity. Reduced-motion execution was not separately tested in this follow-up.

## Lobby integration

- Copies used by the app: `public/assets/secret-council/avatar-male.png`, `avatar-female.png`, and `council-long-table.png`.
- `PlayerAvatar.tsx` plays 12 frames at 24fps on public readiness changes, reverses from the current frame on interruption, initializes at the current endpoint, and snaps under reduced motion. Per-frame CSS registration aligns the cutout centre/bottom; the source pixels remain unchanged. Missing/failed art uses the neutral SVG silhouette.
- `CouncilTable.tsx` keeps six ID-sorted seats, displays six front-facing occupants on desktop, and switches to two rows of three at 900px. Characters and all live labels/controls are separate from table art. Mobile retains full roster details and a sticky readiness control.
- `tests/ui/verify-lobby-motion.cjs` passed 320/390/768/1440px layout and image checks, create-room avatar choice, 1/2/6-member fixtures, intermediate/reverse/interrupted motion, public all-ready updates, reduced motion and asset-error fallback, without runtime errors. Screenshots are in `tests/ui/artifacts/long-table-*.png`.
- Both the final full isolated UI regression suite and the dedicated lobby suite passed. An intermediate full run stopped at a game-board action button intercepted by the mobile header/tabs while separate board work was changing; the subsequent complete rerun passed. Lint, TypeScript, production build, session-clock (6), Spark engine (8) and diff checks also passed. Backend command/rules suites were not rerun for this presentation-only revision; no deployment or live project writes.
- `lobby-long-table-desktop.png` shows the integrated lobby with the first player ready. The example is served by the isolated fixture, not a live multiplayer room.
- The generated tabletop prompt is in `long-table-generation-prompt.md`.

## Generation prompt specification

One transparent sprite sheet, exactly twelve equal cells in a 4×3 grid. Use a fixed front camera with a slight elevated angle, waist-up seated male with both forearms/hands visible. Keep face, clothes, light, scale and base position consistent. Frames progress from relaxed upright posture to a subtle forward lean with hands resting toward the table. Match the supplied DUKE portrait's adult editorial woodcut/comic ink illustration, fine directional hatching and restrained pigments. Use an ordinary man about 30–40, short wavy dark hair, unadorned charcoal/navy jacket, no insignia, mask, weapon, hat, role props, table, chair, labels, text, drawn grid or background. Leave generous transparent margins.

## Final edit prompt (verbatim)

Edit this twelve-frame male animation sprite sheet with ONE targeted correction: make the character's face noticeably more anonymous through deep ink-navy shadow. Preserve the exact same 4-column 3-row grid, all twelve cell positions, character scale, hair, clothes, hands, torso poses, line art, transparent margins, transparent background, and animation progression. Reduce the light across the forehead, eyes and most of the face considerably in ALL twelve frames. Obscure the eyes in shadow. Retain only restrained warm rim highlights along one cheek edge, nose edge, lower lip and jaw, with fine woodcut hatching still visible in the shadows. It should remain an elegant detailed ink illustration matching COUP role-card art, rather than a featureless black silhouette. No masks, hood, eye glow, props, text, labels, drawn grid, backgrounds, new garments or new symbols. Keep true RGBA transparency. Preserve 12 frames exactly and their consistent positions.
