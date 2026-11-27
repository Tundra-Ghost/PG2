# Admin area

Only accounts listed in the server's `ADMIN_ACCOUNT_IDS` setting can open it. The server checks every
`/api/admin` request; everyone else gets a bare 403. The menu shows **Admin** only to those accounts.

## Make your account an admin
1. Sign in on the game. Open **Settings > Account** and copy the line **Account id** (it is case sensitive).
2. From the repo root run: `fly secrets set ADMIN_ACCOUNT_IDS=<your id> -a pigeon-chess-server`
   (several admins: comma separated, no spaces). Fly restarts the server with it.
3. Reload the game. **Admin** appears in the main menu.

Never commit an account id or email. To remove admins, set the secret again or `fly secrets unset ADMIN_ACCOUNT_IDS`.

## Tabs
- **Overview:** game and server versions (`docs/versioning.md`).
- **Stats:** accounts, and anonymous visitors per day. No IPs are stored: a visitor is a hash of the IP with a
  salt that changes every UTC day. Raw events are kept 30 days, then only daily totals.
- **Surveys:** every post-game survey answer with filters, totals and a CSV download.
- **Moderation:** find an account, see its open games and feedback, ban or unban it (blocks sign-in, signs it
  out, drops its connections and seats), rename it (changes the username others see and the one it signs in
  with), end a stuck online room. Every action is written to the audit log shown on the same tab.
  Players can't report each other yet, so there is no report queue.
