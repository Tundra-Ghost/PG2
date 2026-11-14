# Working on Pigeon Chess

## Merging
- Always merge your changes once they pass checks. Open a PR, wait for CI to go green, then merge it into `main`. Do not wait to be asked.
- If CI fails, fix the cause and push again. Never skip or disable a test to get green.

## Checks
- `pnpm typecheck`, `pnpm test`, and `pnpm --filter @pigeon-chess/web build` are what CI runs.

## The team
Role agents live in `.claude/agents/`. Each has one job:

| Agent | Job |
|---|---|
| `manager` | Keeps the "Team board" issue, assigns cards and bugs so nobody overlaps, checks on sessions, reports to the owner |
| `builder` | Turns design cards from `docs/modifier-bible.md` into playable modifiers, with tests |
| `graphic-artist` | Owns the look: palette, contrast, layout on phone and desktop, and the modifier icons |
| `playtester` | Plays the local build in a browser at phone and desktop sizes, files `playtest` issues |
| `balance-analyst` | Runs the balance harness and flags cards outside 40% to 60% win rate |
| `rules-keeper` | Checks cards against the bible's rules and keeps the bible matching the code |
| `reviewer` | Reviews every PR for bugs, interactions, contrast and phone use before merge |

How work flows:
- A builder takes cards nobody else is building. Each builder works on its own branch and merges `origin/main` before opening its PR.
- Before merging a modifier PR, run the `rules-keeper` and `reviewer` agents on it and fix what they find.
- Playtest issues are the bug queue. Fix them in small PRs that reference the issue.
- Rules bugs go to a builder; visual bugs go to the graphic artist. The manager decides when it is unclear.
- Any visual change runs `node game/scripts/contrast-audit.cjs` (with `pnpm dev` running) and is checked at phone and desktop sizes.
- Never build a card that conflicts with one being built on another branch; check open PRs first.
