# NqznZee Arena · Shared Online Rooms v1 — Test Report

## Build base
- NqznZee Chess V9.10 integrated build.
- Caro 0.6.5 UI/Elo integration base (gameplay Caro remains the 0.6.4 line).

## Added
- `/online/index.html`
- `/online/online.css`
- `/online/online.js`
- `supabase/database/05_shared_online_rooms.sql`
- `ONLINE_ROOMS_SETUP.md`

## Entry points
- Home: **Chơi Online**.
- Chess `play.html`: new **ONLINE** control tab.
- Caro lobby: new **Chơi Online** action.

## Room v1 features
- 4-digit room codes with leading zero support.
- Shared `game_rooms` table for `chess` / `caro`.
- Auth required.
- Create / join / leave / cancel.
- Two seats only.
- Server-side display-name snapshot.
- Chess Elo snapshot from `ratings.bot_rating`.
- Caro Elo snapshot from optional `caro_ratings`, otherwise 1000.
- Random Chess White/Black or Caro X/O when guest joins.
- Ready / unready.
- Host-only Start.
- Postgres Changes subscription for room state updates.
- Room URL can carry `?room=1234` for refresh/reconnect to a room the account already belongs to.
- RLS: only members can select a room; mutations use SECURITY DEFINER RPCs.

## Static validation
- `online.js`: Node syntax PASS.
- `caro.js`: Node syntax PASS.
- HTML parser: root / Chess / Caro / Online PASS.
- Local-relative href/src scan: 0 missing files.
- HTTP test using local static server:
  - `/` 200
  - `/play.html?panel=online` 200
  - `/caro/` 200
  - `/online/?game=chess` 200
  - `/online/?game=caro` 200
  - `/online/online.js` 200
  - `/supabase/database/05_shared_online_rooms.sql` 200

## Supabase test required by owner
The SQL migration must be run in the owner's Supabase project before cross-device room tests can work. This environment did not modify the live Supabase project.

## Intentional v1 boundary
Room/lobby realtime is implemented. Chess/Caro **move synchronization is not yet wired**. After Start, the room becomes `playing` and links into the appropriate game with `online_room`, `room_code`, and assigned `side` query parameters. The next online milestone should use that room ID to validate and broadcast moves server-side.
