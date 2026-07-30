# NGUYENENGINE MAX 1.0 — Deep Threat Search

Base: NqznZee Arena Online Rooms V1.3 (Chess/Caro rooms separated).

## Added
- Fifth Caro bot: `NGUYENENGINE MAX`
- Subtitle: `Deep Threat Search`
- No Elo is shown or assigned in the UI for MAX.
- Existing `NguyenEngine Caro · 2200 Elo` remains unchanged.

## Engine behavior
- Iterative deepening alpha-beta search.
- Assumes the opponent chooses their strongest reply (minimax behavior).
- Root blunder filter rejects moves that expose an immediate opponent win whenever a safe move exists.
- Forced-win and forced-defense moves receive highest ordering priority.
- Scoring detection respects already-claimed groups, matching CycleGame rules.
- Bonus-turn aware search: when a move scores, the same side can remain the side to move and the search extends the score+bonus sequence.
- Tactical extension at the horizon for immediate scoring/defensive threats.
- Candidate generation scans threats around the whole occupied board, not only the last move.
- Search budget in integration: ~1350 ms per MAX turn, plus a short UI delay.

## UI
Bot picker now contains:
- Dễ · 700 Elo
- Thường · 1000 Elo
- Khó · 1400 Elo
- Cực khó · 2200 Elo / NguyenEngine Caro
- NGUYENENGINE MAX / Deep Threat Search

In-game identity for MAX:
- Name: `NGUYENENGINE MAX`
- Meta: `Deep Threat Search`
- No Elo text.

## Files changed/added
- `caro/index.html`
- `caro/styles.css`
- `caro/caro.js`
- `caro/caro-max-engine.js` (new)
- `caro/test-nguyenengine-max.js` (test only)

## Compatibility
- No Supabase SQL changes.
- Chess `play.html` is byte-for-byte unchanged from Online Rooms V1.3.
- Existing Online Caro room logic is untouched.

## Tests passed
- `node --check caro/cycle-engine.js`
- `node --check caro/caro-max-engine.js`
- `node --check caro/caro.js`
- `node caro/test-nguyenengine-max.js` -> PASS
- `node caro/test-online-caro-sync.js` -> PASS
- Static integration assertions -> PASS
- `play.html` SHA-256 matches V1.3 base -> PASS
- Local HTTP 200: `/`, `/caro/`, `/caro/caro-max-engine.js`, `/caro/caro.js`, `/caro/styles.css`

Note: No finite browser AI can be truthfully guaranteed mathematically unbeatable on every possible infinite-board/custom-rule position. MAX is designed to avoid obvious tactical losses and search substantially deeper/more defensively than the 2200 bot.
