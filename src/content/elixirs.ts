/** The Arcanum's elixir rack (CONTENT_CATALOG.md §14): 3 tiers × 5 attributes. */
import { z } from 'zod';
import type { AttributeId } from '@/engine/types';

export interface ElixirDef {
  id: string;
  attribute: AttributeId;
  tier: 1 | 2 | 3;
  nameKey: string;
}

export const elixirSchema = z.object({
  id: z.string().min(1),
  attribute: z.enum(['str', 'dex', 'int', 'con', 'lck']),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  nameKey: z.string().startsWith('elixir.'),
});

const TIERS = [1, 2, 3] as const;
const ATTRS: AttributeId[] = ['str', 'dex', 'int', 'con', 'lck'];

export const ELIXIRS: readonly ElixirDef[] = TIERS.flatMap((tier) =>
  ATTRS.map((attribute) => ({
    id: `elixir-${attribute}-${tier}`,
    attribute,
    tier,
    nameKey: `elixir.t${tier}.${attribute}`,
  })),
);

export function getElixir(id: string): ElixirDef {
  const def = ELIXIRS.find((e) => e.id === id);
  if (!def) throw new Error(`Unknown elixir: ${id}`);
  return def;
}
