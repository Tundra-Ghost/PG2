# Working on Pigeon Chess

## Merging
- Always merge your changes once they pass checks. Open a PR, wait for CI to go green, then merge it into `main`. Do not wait to be asked.
- If CI fails, fix the cause and push again. Never skip or disable a test to get green.

## Checks
- `pnpm typecheck`, `pnpm test`, and `pnpm --filter @pigeon-chess/web build` are what CI runs.
