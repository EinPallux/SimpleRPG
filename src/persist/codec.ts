/**
 * Save export/import codec (TECHNICAL_ARCHITECTURE.md §4).
 * Format: "SRPG1." + base64( JSON{ v, crc, payload } ), unicode-safe.
 * Decoding validates checksum, migrates old versions forward, and zod-validates.
 */
import { SAVE_VERSION } from '@/engine/constants';
import type { GameSave } from '@/engine/types';
import { crc32 } from './crc32';
import { migrateSave } from './migrations';

const MAGIC = 'SRPG1.';

export type CodecErrorReason = 'malformed' | 'checksum' | 'futureVersion' | 'invalid';

export class CodecError extends Error {
  readonly reason: CodecErrorReason;
  constructor(reason: CodecErrorReason, message?: string) {
    super(message ?? `Save code rejected: ${reason}`);
    this.name = 'CodecError';
    this.reason = reason;
  }
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeSave(save: GameSave): string {
  const payload = JSON.stringify(save);
  const wrapper = { v: save.version, crc: crc32(payload), payload };
  return MAGIC + toBase64(JSON.stringify(wrapper));
}

export function decodeSave(code: string): GameSave {
  const trimmed = code.trim();
  if (!trimmed.startsWith(MAGIC)) throw new CodecError('malformed', 'Not a SimpleRPG save code.');
  let wrapper: { v: unknown; crc: unknown; payload: unknown };
  try {
    wrapper = JSON.parse(fromBase64(trimmed.slice(MAGIC.length))) as typeof wrapper;
  } catch {
    throw new CodecError('malformed', 'Save code is damaged and could not be read.');
  }
  if (typeof wrapper.payload !== 'string' || typeof wrapper.crc !== 'number') {
    throw new CodecError('malformed');
  }
  if (crc32(wrapper.payload) !== wrapper.crc) {
    throw new CodecError('checksum', 'Save code failed its integrity check.');
  }
  let raw: unknown;
  try {
    raw = JSON.parse(wrapper.payload);
  } catch {
    throw new CodecError('malformed');
  }
  const version =
    typeof raw === 'object' && raw !== null && 'version' in raw
      ? Number((raw as { version: unknown }).version)
      : NaN;
  if (!Number.isInteger(version)) throw new CodecError('malformed');
  if (version > SAVE_VERSION) {
    throw new CodecError('futureVersion', 'This save comes from a newer game version.');
  }
  return migrateSave(raw);
}
