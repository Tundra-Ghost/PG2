import { DatabaseSync } from 'node:sqlite';
import { createFeedbackStore, feedbackAsMarkdown } from './feedback';
import { createSurveyStore, surveySummary } from './survey';

/**
 * Reads player feedback for prompting.
 *   pnpm --filter @pigeon-chess/server feedback            open feedback as Markdown
 *   pnpm --filter @pigeon-chess/server feedback all        including handled items
 *   pnpm --filter @pigeon-chess/server feedback done 3 4   mark items handled
 *   pnpm --filter @pigeon-chess/server feedback surveys    post-game survey summary
 * On Fly: fly ssh console -C "pnpm --filter @pigeon-chess/server feedback"
 */
const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error('Set DB_PATH to the accounts database (on Fly it is already set).');
  process.exit(1);
}

const db = new DatabaseSync(dbPath);
const store = createFeedbackStore(db);
const [command, ...args] = process.argv.slice(2);

if (command === 'surveys') {
  console.log(surveySummary(createSurveyStore(db).list()));
} else if (command === 'done') {
  const ids = args.map(Number).filter(Number.isInteger);
  console.log(`Marked ${store.markDone(ids)} item(s) done.`);
} else {
  console.log(feedbackAsMarkdown(store.list(command === 'all' ? undefined : 'open')));
}
