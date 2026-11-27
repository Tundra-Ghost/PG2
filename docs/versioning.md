# Version numbers

The game and the server share one scheme: **`0.YYYY.MM.DD.N`**.

- `YYYY.MM.DD` is the UTC date of the commit the build was made from.
- `N` counts the commits on `main` that day, so the first merge of the day is `.1`, the next `.2`.
- Nobody bumps it by hand. `scripts/build-info.mjs` works it out from git at build time, together with
  the short commit hash and the build date.

Where it shows:
- **Settings, Feedback tab:** "Pigeon Chess · Version 0.2026.11.27.3 · abc1234 · built 27 Nov 2026".
- **Admin, Overview:** the game's version and the server's, with a note when they differ.

How each side gets it:
- The game: `game/vite.config.ts` calls `buildInfo()` and bakes it in as `__BUILD_INFO__`.
- The server: the Deploy server workflow writes `apps/server/build-info.json` before `flyctl deploy`
  (the Docker image has no git). Locally the server runs the same script. Without git either side
  says `0.0.0-dev`.

Both deploy workflows check out full history (`fetch-depth: 0`), or `N` would be wrong.

The server only redeploys when server code changes, so after a game-only merge the server's version is
older than the game's. That is expected. A difference after a server change means the deploy failed.
