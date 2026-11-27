/** One survey response as the admin log receives it. */
export interface AdminSurveyResponse {
  id: number;
  createdAt: number;
  survey: string;
  username: string | null;
  answers: { id: string; kind: string; question: string; answer: number | string | string[] }[];
  context: Record<string, unknown>;
}

function cell(value: unknown): string {
  let text = Array.isArray(value) ? value.join('; ') : value === undefined || value === null ? '' : String(value);
  // A leading = + - @ would run as a formula in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV with one row per response and one column per question. */
export function surveysToCsv(responses: AdminSurveyResponse[]): string {
  const questions = new Map<string, string>();
  for (const r of responses) for (const a of r.answers) if (!questions.has(a.id)) questions.set(a.id, a.question);
  const header = ['id', 'date', 'player', 'survey', 'version', 'mode', 'result', 'modifiers', ...[...questions.values()]];
  const rows = responses.map(r => {
    const byId = new Map(r.answers.map(a => [a.id, a.answer]));
    return [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.username ?? 'guest',
      r.survey,
      r.context.version ?? 'unknown',
      r.context.mode,
      r.context.result,
      r.context.modifiers,
      ...[...questions.keys()].map(id => byId.get(id)),
    ].map(cell).join(',');
  });
  return [header.map(cell).join(','), ...rows].join('\r\n') + '\r\n';
}
