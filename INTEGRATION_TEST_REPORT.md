# NqznZee Arena + Caro 0.6.4 — Integration Test Report

## Base
- Chess: original V9.10 source from `NqznZee_Web_Share_V9_10_Engine_Captured_Models.zip`
- Caro: `NqznZee_CARO_LAB_0_6_4.zip`

## Integration changes
- Added `/caro/` module.
- Added `Caro Điểm` card to original Arena home page.
- Added `Caro` item to mobile bottom nav; nav grid changed from 4 to 5 columns.
- Added return links from Caro to `../index.html`.
- Added minimal `manifest.webmanifest` because original `play.html` references it but the provided source archive did not include it.

## Safety check
- `play.html` is byte-for-byte unchanged from original V9.10.
- SHA-256: `cf211a2021a0a56214df34e90d5f85f6bcdfad2f4c38e48f6d2594c5158c4d19`

## Caro tests
- Cycle/point grouping: PASS
- Dynamic pieces-per-point and win target: PASS
- Bonus turn after scoring: PASS
- Bot/setup/UI flow: PASS
- JavaScript syntax: PASS

## Static GitHub-style HTTP checks
- `/` -> 200
- `/play.html?v=9.10` -> 200
- `/caro/` -> 200
- `/caro/styles.css` -> 200
- `/caro/caro.js` -> 200
- `/caro/cycle-engine.js` -> 200
- `/manifest.webmanifest` -> 200
- Missing local href/src references in main pages: 0

## Deployment
Upload the CONTENTS of this package to a test branch/repository root. Keep the `caro/` directory intact.
