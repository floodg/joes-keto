import { supabase } from '../../lib/supabase';
import type { InventoryTransaction, InventoryTransactionType } from '../../domain/types';

// ─── DB row shape ─────────────────────────────────────────────────────────────

interface DbInventoryTransaction {
  id: string;
  user_id: string;
  ingredient_name: string;
  quantity_delta: number;
  unit: string | null;
  transaction_type: string;
  source_type: string | null;
  source_id: string | null;
  occurred_at: string;
  created_at: string;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function dbToDomain(row: DbInventoryTransaction): InventoryTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    ingredientName: row.ingredient_name,
    quantityDelta: row.quantity_delta,
    unit: row.unit ?? undefined,
    transactionType: row.transaction_type as InventoryTransactionType,
    sourceType: row.source_type ?? undefined,
    sourceId: row.source_id ?? undefined,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface CreateInventoryTransactionInput {
  userId: string;
  ingredientName: string;
  quantityDelta: number;
  unit?: string;
  transactionType: InventoryTransactionType;
  sourceType?: string;
  sourceId?: string;
  occurredAt?: string;
}

/**
 * Record a new inventory transaction (purchase, meal consumption, waste, or manual adjustment).
 */
export async function createInventoryTransaction(
  input: CreateInventoryTransactionInput
): Promise<InventoryTransaction> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .insert({
      user_id: input.userId,
      ingredient_name: input.ingredientName,
      quantity_delta: input.quantityDelta,
      unit: input.unit ?? null,
      transaction_type: input.transactionType,
      source_type: input.sourceType ?? null,
      source_id: input.sourceId ?? null,
      occurred_at: input.occurredAt,
    })
    .select()
    .single();

  if (error) throw error;
  return dbToDomain(data as DbInventoryTransaction);
}

/**
 * Fetch all inventory transactions for the current user, ordered most-recent first.
 */
export async function getInventoryTransactions(): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return (data as DbInventoryTransaction[]).map(dbToDomain);
}

/**
 * Fetch inventory transactions for a specific ingredient.
 */
export async function getTransactionsForIngredient(
  ingredientName: string
): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .eq('ingredient_name', ingredientName)
    .order('occurred_at', { ascending: false });

  if (error) throw error;
  return (data as DbInventoryTransaction[]).map(dbToDomain);
}

/**
 * Calculate the current stock level for each ingredient by summing all deltas.
 * Returns a map of ingredient_name -> current quantity, using a database-level
 * aggregate view for efficiency.
 */
export async function getIngredientStockLevels(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('inventory_stock_levels')
    .select('ingredient_name, current_quantity');

  if (error) throw error;

  const stock: Record<string, number> = {};
  for (const row of data as { ingredient_name: string; current_quantity: number }[]) {
    stock[row.ingredient_name] = row.current_quantity;
  }
  return stock;
}
