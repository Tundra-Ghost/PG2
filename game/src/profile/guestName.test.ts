import { describe, expect, it } from 'vitest';
import { randomGuestName } from '../profile';

describe('randomGuestName', () => {
  it('fits the 20 character display name limit, even at its longest', () => {
    for (const roll of [0, 0.25, 0.5, 0.75, 0.9999]) {
      const name = randomGuestName(() => roll);
      expect(name.length).toBeLessThanOrEqual(20);
      expect(name).toMatch(/^[A-Za-z]+\d{4}$/);
    }
  });
});
