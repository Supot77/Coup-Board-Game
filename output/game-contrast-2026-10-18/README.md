# Game contrast refresh — 2026-10-18

Approved direction: balanced contrast. Ink navigation, readable ivory panels over a visible but subordinate council background, saturated role portraits and intentional red/teal status accents. No new raster assets were needed; GameIcon.tsx supplies a shared native SVG family.

Previews captured from the isolated UI fixture at 320x568, 390x844, 768x1024 and 1440x1000. board-* shows cards/general actions; actions-* shows role actions; response-* shows the response dialog; exchange-* shows Exchange. These are real rendered components with simulated state, not production rooms. The fixture room identifier TEST is not an example of a valid production room code.

Contrast samples computed from rendered solid foreground/background colors: header wordmark 14.69:1; active turn status 6.10:1; action title 15.15:1; header rules button 14.69:1. This is a targeted contrast check, not a full accessibility certification. Screenshots were allowed 200ms for button state transitions to settle before capture.

Repeat: node output/game-contrast-2026-10-18/verify-game.cjs
Requires local isolated UI fixture on 5198 and the temporary Playwright installation already used by previous UI work. The verifier checks four viewport sizes, forward UI reachability, no horizontal document overflow, hidden opponent portrait privacy, contrast samples and response close/reopen.

Full regression: UI_TEST_BASE=http://127.0.0.1:5198/tests/ui/index.html; node tests/ui/verify.cjs [playwright-path] [chrome-path]. Touch swipes now use the actual action column bounds because mobile navigation is at the bottom of the screen.
