/** The ten zones of Aethermoor (CONTENT_CATALOG.md §3), mapped to repo art. */
import { z } from 'zod';

export interface ZoneDef {
  id: string;
  /** 1-based zone index — mission math uses the index, not the array position. */
  index: number;
  nameKey: string;
  minLevel: number;
  /** background base name under public/assets/bg */
  bg: string;
}

export const zoneSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(1),
  nameKey: z.string().startsWith('zone.'),
  minLevel: z.number().int().min(1),
  bg: z.string().min(1),
});

export const ZONES: readonly ZoneDef[] = [
  {
    id: 'bramblewood',
    index: 1,
    nameKey: 'zone.bramblewood.name',
    minLevel: 1,
    bg: 'mission_background_10',
  },
  {
    id: 'millhaven',
    index: 2,
    nameKey: 'zone.millhaven.name',
    minLevel: 8,
    bg: 'mission_background_11',
  },
  {
    id: 'blossomvale',
    index: 3,
    nameKey: 'zone.blossomvale.name',
    minLevel: 16,
    bg: 'mission_background_12',
  },
  {
    id: 'deepwood',
    index: 4,
    nameKey: 'zone.deepwood.name',
    minLevel: 25,
    bg: 'mission_background_13',
  },
  {
    id: 'saltmere',
    index: 5,
    nameKey: 'zone.saltmere.name',
    minLevel: 35,
    bg: 'mission_background_14',
  },
  {
    id: 'sunscorch',
    index: 6,
    nameKey: 'zone.sunscorch.name',
    minLevel: 45,
    bg: 'mission_background_8',
  },
  {
    id: 'ashenreach',
    index: 7,
    nameKey: 'zone.ashenreach.name',
    minLevel: 60,
    bg: 'mission_background_4',
  },
  {
    id: 'cinderpeak',
    index: 8,
    nameKey: 'zone.cinderpeak.name',
    minLevel: 75,
    bg: 'mission_background_6',
  },
  {
    id: 'frostveil',
    index: 9,
    nameKey: 'zone.frostveil.name',
    minLevel: 90,
    bg: 'mission_background_7',
  },
  {
    id: 'duskgate',
    index: 10,
    nameKey: 'zone.duskgate.name',
    minLevel: 105,
    bg: 'mission_background_5',
  },
];

/** Highest zone index unlocked at a hero level (zones unlock by band start). */
export function frontierZoneIndex(level: number): number {
  let frontier = 1;
  for (const zone of ZONES) if (level >= zone.minLevel) frontier = zone.index;
  return frontier;
}

export function getZone(index: number): ZoneDef {
  const zone = ZONES[index - 1];
  if (!zone) throw new Error(`Unknown zone index: ${index}`);
  return zone;
}
