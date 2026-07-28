/**
 * Bot username & guild-tag corpus (CONTENT_CATALOG.md §12). Three styles keep
 * the ladder looking like a real server: fantasy names, gamer tags, roleplay
 * handles. Names are generated identifiers, not translatable copy.
 */

export const FANTASY_FIRST: readonly string[] = [
  'Ael', 'Bryn', 'Cael', 'Dra', 'Elow', 'Fenn', 'Gor', 'Hal', 'Isen', 'Jor',
  'Kael', 'Lyra', 'Mor', 'Nym', 'Ola', 'Pryn', 'Quill', 'Ryn', 'Syl', 'Thal',
  'Ulf', 'Vael', 'Wyn', 'Xan', 'Yor', 'Zeph', 'Ash', 'Bram', 'Corv', 'Dun',
  'Ember', 'Fal', 'Grim', 'Hazel', 'Iron', 'Juni', 'Kest', 'Lark', 'Mab', 'North',
];

export const FANTASY_LAST: readonly string[] = [
  'dor', 'wyn', 'grim', 'ella', 'ric', 'wick', 'mere', 'thorn', 'bane', 'low',
  'shade', 'brook', 'fell', 'hart', 'stone', 'vale', 'weld', 'born', 'gale', 'iron',
  'leaf', 'march', 'nock', 'pike', 'quist', 'rowan', 'sky', 'thistle', 'under', 'vane',
  'ward', 'wood', 'yarrow', 'zell', 'ash', 'bell', 'crow', 'dawn', 'ford', 'holt',
];

export const GAMER_CORES: readonly string[] = [
  'Shadow', 'Dragon', 'Toxic', 'Pixel', 'Turbo', 'Mega', 'Silent', 'Crazy', 'Dark', 'Epic',
  'Ninja', 'Ghost', 'Hyper', 'Ultra', 'Sneaky', 'Salty', 'Cosmic', 'Rusty', 'Spicy', 'Frosty',
  'Lucky', 'Grumpy', 'Swift', 'Iron', 'Chaos', 'Rogue', 'Void', 'Neon', 'Doom', 'Fluffy',
  'Angry', 'Sleepy', 'Blaze', 'Storm', 'Venom', 'Wicked', 'Zero', 'Alpha', 'Omega', 'Potato',
];

export const RP_ADJECTIVES: readonly string[] = [
  'Bold', 'Unwashed', 'Patient', 'Sleepy', 'Magnificent', 'Frugal', 'Loud', 'Humble',
  'Untippable', 'Relentless', 'Cautious', 'Giddy', 'Stalwart', 'Wandering', 'Sly',
  'Honest-ish', 'Thorough', 'Unlucky', 'Caffeinated', 'Ready',
];

export const GUILD_TAGS: readonly string[] = [
  'FORGE', 'MOSS', 'WYRM', 'OATH', 'GRIN', 'HEXE', 'RUNE', 'SALT', 'DUSK', 'ALE!',
  'BONK', 'OWL', 'PYRE', 'THRN', 'VOID', 'YAWN', 'GLHF', 'BRB', 'NOPE', 'KEG',
];

const LEET: Record<string, string> = { a: '4', e: '3', o: '0' };

export function leetify(name: string): string {
  return name
    .split('')
    .map((c) => LEET[c.toLowerCase()] ?? c)
    .join('');
}
