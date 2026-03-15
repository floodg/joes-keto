import { supabase } from '../../lib/supabase';

type Unit = 'g' | 'ml' | 'units';

export interface PantryItem {
  id: string;
  userId: string;
  productId?: string;
  ingredientId: string;
  ingredientName: string;
  productName?: string;
  purchasedQty: number;
  consumedQty: number;
  remainingQty: number;
  unit: Unit;
  lastPurchaseDate?: string; // ISO date (YYYY-MM-DD)
  autoReorder: boolean;
  updatedAt?: string; // ISO
}

interface DbPantryRow {
  id: string;
  user_id: string;
  product_id: string | null;
  ingredient_id: string;
  purchased_qty: number;
  consumed_qty: number;
  remaining_qty: number;
  unit: Unit;
  last_purchase_date: string | null;
  auto_reorder: boolean;
  updated_at: string | null;
  ingredients: { name: string } | null;
  store_products: { name: string } | null;
}

function dbToDomain(row: DbPantryRow): PantryItem {
  return {
    id: row.id,
    userId: row.user_id,
    productId: row.product_id ?? undefined,
    ingredientId: row.ingredient_id,
    ingredientName: row.ingredients?.name ?? '',
    productName: row.store_products?.name ?? undefined,
    purchasedQty: Number(row.purchased_qty ?? 0),
    consumedQty: Number(row.consumed_qty ?? 0),
    remainingQty: Number(row.remaining_qty ?? 0),
    unit: row.unit,
    lastPurchaseDate: row.last_purchase_date ?? undefined,
    autoReorder: row.auto_reorder,
    updatedAt: row.updated_at ?? undefined,
  };
}

async function ensureIngredientIdByName(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Ingredient name is required.');
  // Try select first
  {
    const { data, error } = await supabase
      .from('ingredients')
      .select('id')
      .eq('name', trimmed)
      .maybeSingle();
    if (!error && data) return (data as { id: string }).id;
  }
  // Insert if missing
  const { data, error } = await supabase
    .from('ingredients')
    .insert({ name: trimmed, optional: false, pantry_staple: false })
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function getPantryItems(): Promise<PantryItem[]> {
  const { data, error } = await supabase
    .from('pantry_inventory')
    .select(`
      id, user_id, product_id, ingredient_id, purchased_qty, consumed_qty, remaining_qty, unit, last_purchase_date, auto_reorder, updated_at,
      ingredients:ingredient_id(name),
      store_products:product_id(name)
    `)
    .order('ingredient_id', { ascending: true });
  if (error) throw error;
  // PostgREST relational shapes can be typed as arrays in generic SDK types; coerce to our shape.
  const rows = (data as any[]).map(row => dbToDomain(row as unknown as DbPantryRow));
  // Sort by ingredientName for stable UI
  return rows.sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

/**
 * Add stock using linked product pack sizes. Falls back to direct quantity when no link.
 */
export async function addStockByPacks(ingredientName: string, packs: number): Promise<PantryItem> {
  if (!(packs > 0)) throw new Error('Pack count must be greater than zero.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ingredientId = await ensureIngredientIdByName(ingredientName);

  // Find user-linked store product for this ingredient
  const { data: link, error: linkErr } = await supabase
    .from('store_products')
    .select('id, pack_size_g, pack_size_ml, pack_size_units')
    .eq('user_id', user.id)
    .eq('ingredient_id', ingredientId)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) {
    throw new Error('No linked product found. Please link a product or enter a quantity directly.');
  }
  const productId = (link as any).id as string;
  const packG = (link as any).pack_size_g as number | null;
  const packMl = (link as any).pack_size_ml as number | null;
  const packUnits = (link as any).pack_size_units as number | null;

  let unit: Unit;
  let unitQty: number;
  if (packG && packG > 0) {
    unit = 'g'; unitQty = packG;
  } else if (packMl && packMl > 0) {
    unit = 'ml'; unitQty = packMl;
  } else if (packUnits && packUnits > 0) {
    unit = 'units'; unitQty = packUnits;
  } else {
    throw new Error('Linked product has no valid pack size.');
  }

  const qty = Number(packs) * unitQty;

  // Use server-side increment via RPC to satisfy "never replace, only increment"
  const { data: rpcRow, error: rpcErr } = await supabase.rpc('pantry_add_stock', {
    p_user_id: user.id,
    p_ingredient_id: ingredientId,
    p_product_id: productId,
    p_qty: qty,
    p_unit: unit,
  });
  if (rpcErr) throw rpcErr;
  return dbToDomain(rpcRow as DbPantryRow);
}

/**
 * Add stock directly with a numeric quantity (no linked product).
 */
export async function addStockDirect(ingredientName: string, unit: Unit, quantity: number): Promise<PantryItem> {
  if (!(quantity > 0)) throw new Error('Quantity must be greater than zero.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const ingredientId = await ensureIngredientIdByName(ingredientName);

  const { data: rpcRow, error: rpcErr } = await supabase.rpc('pantry_add_stock', {
    p_user_id: user.id,
    p_ingredient_id: ingredientId,
    p_product_id: null,
    p_qty: quantity,
    p_unit: unit,
  });
  if (rpcErr) throw rpcErr;
  return dbToDomain(rpcRow as DbPantryRow);
}

export async function setAutoReorder(pantryId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('pantry_inventory')
    .update({ auto_reorder: enabled })
    .eq('id', pantryId);
  if (error) throw error;
}

