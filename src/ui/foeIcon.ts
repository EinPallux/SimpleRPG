import type { ArchetypeId } from '@/engine/constants';
import type { IconId } from './icons.gen';

/**
 * Archetype → the glyph that stands in for it in combat playback.
 *
 * Shared rather than redeclared: mission fights, expedition cards and dungeon
 * bosses all show a foe portrait, and the same archetype must not be a wolf in
 * one place and a raven in another.
 */
export const FOE_ICON: Record<ArchetypeId, IconId> = {
  grunt: 'wolf',
  swift: 'raven',
  caster: 'mage',
  brute: 'dragon',
  elite: 'crown',
};
