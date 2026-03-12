import { supabase } from '../../lib/supabase';
import type { InventoryTransaction, InventoryTransactionType } from '../../domain/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a raw unit string to its canonical abbreviation.
 * Mirrors the logic in shopping/quantityUtils so that inventory units
 * can be matched directly against parsed ingredient quantities.
 */
function normalizeInventoryUnit(raw: string): string {
  const u = raw.toLowerCase().trim();
  if (u === "gram" || u === "grams" || u === "g") return "g";
  if (u === "kilogram" || u === "kilograms" || u === "kg") return "kg";
  if (u === "milliliter" || u === "milliliters" || u === "millilitre" || u === "millilitres" || u === "ml") return "ml";
  if (u === "liter" || u === "liters" || u === "litre" || u === "litres" || u === "l") return "l";
  if (u === "unit" || u === "units" || u === "piece" || u === "pieces" || u === "pcs") return "units";
  return u;
}

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
 * Calculate the current stock level for each ingredient by summing all deltas,
 * broken down by unit.
 *
 * Returns a nested map:
 *   lowercase(ingredient_name) → normalised_unit → current_quantity
 *
 * Unit keys are normalised (via the same rules as `quantityUtils.normalizeUnit`)
 * so that they can be matched directly against parsed ingredient quantities.
 * A null unit in the database is represented as an empty string "".
 */
export async function getIngredientStockLevels(): Promise<Record<string, Record<string, number>>> {
  const { data, error } = await supabase
    .from('inventory_stock_levels')
    .select('ingredient_name, unit, current_quantity');

  if (error) throw error;

  const stock: Record<string, Record<string, number>> = {};
  for (const row of data as { ingredient_name: string; unit: string | null; current_quantity: number }[]) {
    const key = row.ingredient_name.toLowerCase();
    // Normalise unit so it can be matched against parsed ingredient quantities.
    const unit = row.unit ? normalizeInventoryUnit(row.unit) : "";
    if (!stock[key]) stock[key] = {};
    stock[key][unit] = row.current_quantity;
  }
  return stock;
}
