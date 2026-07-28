import { describe, expect, it } from 'vitest';
import { createNewSave, deriveEmblem } from '@/engine/newSave';
import { CodecError, decodeSave, encodeSave } from './codec';

const save = createNewSave(
  {
    name: 'Röstwyn Äle', // unicode names must survive the codec
    classId: 'mage',
    emblem: deriveEmblem('Röstwyn Äle', 'mage'),
    worldSeed: 'b'.repeat(32),
  },
  new Date(2026, 6, 28).getTime(),
);

describe('save codec', () => {
  it('roundtrips losslessly (incl. unicode)', () => {
    const code = encodeSave(save);
    expect(code.startsWith('SRPG1.')).toBe(true);
    expect(decodeSave(code)).toEqual(save);
  });

  it('rejects non-save garbage as malformed', () => {
    expect(() => decodeSave('hello there')).toThrowError(CodecError);
    try {
      decodeSave('hello there');
    } catch (e) {
      expect((e as CodecError).reason).toBe('malformed');
    }
  });

  it('rejects tampered payloads via checksum', () => {
    const code = encodeSave(save);
    // Corrupt the payload inside the wrapper, keeping the wrapper JSON valid:
    const wrapper = JSON.parse(atob(code.slice('SRPG1.'.length))) as { payload: string };
    wrapper.payload = wrapper.payload.replace('"level":1', '"level":9999');
    const forged = 'SRPG1.' + btoa(JSON.stringify(wrapper));
    try {
      decodeSave(forged);
      expect.unreachable('checksum should have failed');
    } catch (e) {
      expect((e as CodecError).reason).toBe('checksum');
    }
  });

  it('rejects saves from a future game version', () => {
    const future = { ...save, version: 999 };
    const code = encodeSave(future as typeof save);
    try {
      decodeSave(code);
      expect.unreachable('future version should be rejected');
    } catch (e) {
      expect((e as CodecError).reason).toBe('futureVersion');
    }
  });

  it('rejects truncated codes', () => {
    const code = encodeSave(save);
    expect(() => decodeSave(code.slice(0, code.length / 2))).toThrowError(CodecError);
  });
});
