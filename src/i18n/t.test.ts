import { describe, expect, it } from 'vitest';
import { hasKey, t } from './index';

describe('i18n', () => {
  it('returns catalog strings and interpolates params', () => {
    expect(t('app.title')).toBe('SimpleRPG');
    expect(t('common.levelShort', { level: 42 })).toBe('Lv 42');
    expect(t('toast.locked', { name: 'Arena', level: 5 })).toContain('Arena');
  });

  it('knows which keys exist', () => {
    expect(hasKey('nav.tavern')).toBe(true);
    expect(hasKey('nav.doesNotExist')).toBe(false);
  });
});
