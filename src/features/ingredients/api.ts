import { supabase } from '../../lib/supabase';

export interface IngredientFlagsInput {
  name: string;
  optional?: boolean;
  pantryStaple?: boolean;
}

/**
 * Create or update ingredient flags in the global catalog.
 * Uses the unique constraint on `name` to upsert.
 */
export async function upsertIngredientFlags(
  inputs: IngredientFlagsInput[]
): Promise<void> {
  if (inputs.length === 0) return;
  const rows = inputs.map(i => ({
    name: i.name,
    optional: i.optional ?? false,
    pantry_staple: i.pantryStaple ?? false,
  }));
  const { error } = await supabase
    .from('ingredients')
    .upsert(rows, { onConflict: 'name' });
  if (error) throw error;
}

