import { describe, expect, it } from 'vitest';
import { surveysToCsv } from './surveyCsv';

describe('survey CSV', () => {
  it('has one column per question and escapes commas, quotes and formulas', () => {
    const csv = surveysToCsv([
      {
        id: 2,
        createdAt: Date.parse('2026-11-27T10:00:00Z'),
        survey: 'post-game-v1',
        username: null,
        context: { mode: 'bot', result: 'win', modifiers: ['VENT_TILES', 'LAVA'], version: '0.2026.11.27.1' },
        answers: [
          { id: 'fun', kind: 'scale', question: 'How fun?', answer: 5 },
          { id: 'notes', kind: 'text', question: 'Anything else?', answer: '=HYPERLINK("x"), wow' },
        ],
      },
    ]);
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toBe('id,date,player,survey,version,mode,result,modifiers,How fun?,Anything else?');
    expect(row).toBe(`2,2026-11-27T10:00:00.000Z,guest,post-game-v1,0.2026.11.27.1,bot,win,VENT_TILES; LAVA,5,"'=HYPERLINK(""x""), wow"`);
  });
});
