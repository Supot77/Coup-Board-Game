# Sword loading asset and verification

Generated asset: a single horizontal council rapier, hilt left and point right, transparent background, engraved editorial woodcut, ivory blade/navy edge, vermilion guard detail and teal grip wraps. No text, UI, person, scene or role information. Original retained as sword-original.png. Production RGBA WebP at quality 90: public/assets/secret-council/loading-sword.webp (97022 bytes). Alpha was preserved during encoding.

Startup progress counts five settled image preparation tasks plus session readiness (six steps); it is not a transfer byte percentage. Image failures/timeouts settle optional decoration tasks and allow the app to continue with a truthful fallback note. Session readiness is mandatory and is never simulated. A pending session keeps the loader below 100 and shows retry after 15 seconds. Each optional image has an 8-second timeout. Completion shows 100 for 220ms, then opens the app; no additional minimum loading time is imposed.

Other lazy screens use an indeterminate sword because module transfer percentage is unavailable. Reduced-motion removes transitions and indeterminate travel. No game timer is paused by the visual loader.

Test: node tests/ui/verify-loading.cjs D:/Coup/node_modules/.entry-preview-tools/node_modules/playwright "C:/Program Files/Google/Chrome/Application/chrome.exe"
Fixture URL: http://127.0.0.1:5198/tests/ui/index.html?scenario=loading-preview&progress=50
The preview route exists only in the isolated UI test harness. No production preview URL or live Firebase writes.
