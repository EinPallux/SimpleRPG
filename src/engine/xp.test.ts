import { describe, expect, it } from 'vitest';
import { xpToNext } from './xp';

describe('xpToNext (BALANCING.md §2.1)', () => {
  it('matches the published curve values', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(10)).toBe(25119); // ceil(100 × 10^2.4)
  });

  it('is strictly increasing (superlinear growth)', () => {
    let prev = 0;
    for (let level = 1; level <= 200; level++) {
      const next = xpToNext(level);
      expect(next).toBeGreaterThan(prev);
      prev = next;
    }
  });

  it('rejects invalid levels', () => {
    expect(() => xpToNext(0)).toThrow();
  });
});
