import { supabase } from '../../lib/supabase';
import type { Meal, Ingredient, StarterMeal, MealIngredientProduct } from '../../domain/types';

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface DbIngredient {
  id: string;
  meal_id: string;
  name: string;
  quantity: string | null;
  store: string | null;
  notes: string | null;
  sort_order: number;
}

interface DbMeal {
  id: string;
  user_id: string;
  source_starter_meal_id: string | null;
  name: string;
  description: string | null;
  tags: string[];
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  instructions: string[];
  created_at: string;
  updated_at: string;
  meal_ingredients: DbIngredient[];
}

interface DbStoreProduct {
  id: string;
  name: string;
  brand: string | null;
  size_label: string | null;
  store: string;
  product_url: string;
  image_url: string | null;
}

interface DbProductOption {
  store_product_id: string;
  sort_order: number;
  store_products: DbStoreProduct;
}

interface DbStarterIngredient {
  id: string;
  starter_meal_id: string;
  name: string;
  quantity: string | null;
  store: string | null;
  notes: string | null;
  sort_order: number;
  store_product_id: string | null;
  store_products: DbStoreProduct | null;
  starter_meal_ingredient_product_options: DbProductOption[];
}

interface DbStarterMeal {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tags: string[];
  prep_time_mins: number | null;
  cook_time_mins: number | null;
  instructions: string[];
  starter_meal_ingredients: DbStarterIngredient[];
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function dbStoreProductToDomain(row: DbStoreProduct): MealIngredientProduct {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? undefined,
    sizeLabel: row.size_label ?? undefined,
    store: row.store,
    productUrl: row.product_url,
    imageUrl: row.image_url ?? undefined,
  };
}

function dbIngredientToDomain(ing: DbIngredient): Ingredient {
  return {
    id: ing.id,
    name: ing.name,
    quantity: ing.quantity ?? undefined,
    store: ing.store ?? undefined,
    notes: ing.notes ?? undefined,
  };
}

function dbMealToDomain(row: DbMeal): Meal {
  return {
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    ingredients: [...(row.meal_ingredients ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(dbIngredientToDomain),
    instructions: Array.isArray(row.instructions) ? row.instructions : [],
    prepTimeMins: row.prep_time_mins ?? undefined,
    cookTimeMins: row.cook_time_mins ?? undefined,
    sourceStarterMealId: row.source_starter_meal_id ?? undefined,
  };
}

function dbStarterIngredientToDomain(ing: DbStarterIngredient): Ingredient {
  const primaryProduct = ing.store_products
    ? dbStoreProductToDomain(ing.store_products)
    : undefined;

  const optionProducts = [...(ing.starter_meal_ingredient_product_options ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(opt => dbStoreProductToDomain(opt.store_products));

  // Deduplicate options: remove any that match the primary product id
  const deduplicatedOptions = primaryProduct
    ? optionProducts.filter(p => p.id !== primaryProduct.id)
    : optionProducts;

  return {
    id: ing.id,
    name: ing.name,
    quantity: ing.quantity ?? undefined,
    store: ing.store ?? undefined,
    notes: ing.notes ?? undefined,
    primaryProduct,
    productOptions: deduplicatedOptions,
  };
}

function dbStarterMealToDomain(row: DbStarterMeal): StarterMeal {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    tags: row.tags ?? [],
    prepTimeMins: row.prep_time_mins ?? undefined,
    cookTimeMins: row.cook_time_mins ?? undefined,
    instructions: Array.isArray(row.instructions) ? row.instructions : [],
    ingredients: [...(row.starter_meal_ingredients ?? [])]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(dbStarterIngredientToDomain),
  };
}

/**
 * Build a lookup map: (starterMealId, ingredientNameLower) -> Ingredient product data
 * Used to augment user meal ingredients with product links.
 */
function buildProductLookup(
  starterMeals: DbStarterMeal[]
): Map<string, Map<string, Ingredient>> {
  const lookup = new Map<string, Map<string, Ingredient>>();
  for (const sm of starterMeals) {
    const byName = new Map<string, Ingredient>();
    for (const ing of sm.starter_meal_ingredients) {
      byName.set(ing.name.toLowerCase(), dbStarterIngredientToDomain(ing));
    }
    lookup.set(sm.id, byName);
  }
  return lookup;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const STARTER_INGREDIENT_SELECT =
  '*, store_products:store_product_id(*), starter_meal_ingredient_product_options(sort_order, store_product_id, store_products:store_product_id(*))';

export async function getStarterMeals(): Promise<StarterMeal[]> {
  const { data, error } = await supabase
    .from('starter_meals')
    .select(`*, starter_meal_ingredients(${STARTER_INGREDIENT_SELECT})`)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as DbStarterMeal[]).map(dbStarterMealToDomain);
}

export async function getMealsForUser(): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, meal_ingredients(*)')
    .order('created_at', { ascending: true });

  if (error) throw error;
  const meals = data as DbMeal[];

  // Collect unique source_starter_meal_ids to fetch product data
  const starterMealIds = [
    ...new Set(
      meals
        .map(m => m.source_starter_meal_id)
        .filter((id): id is string => id != null)
    ),
  ];

  let productLookup: Map<string, Map<string, Ingredient>> = new Map();

  if (starterMealIds.length > 0) {
    const { data: smData, error: smError } = await supabase
      .from('starter_meals')
      .select(`id, starter_meal_ingredients(${STARTER_INGREDIENT_SELECT})`)
      .in('id', starterMealIds);

    if (smError) throw smError;
    productLookup = buildProductLookup(smData as DbStarterMeal[]);
  }

  return meals.map(meal => {
    const domainMeal = dbMealToDomain(meal);
    if (!meal.source_starter_meal_id) return domainMeal;

    const byName = productLookup.get(meal.source_starter_meal_id);
    if (!byName) return domainMeal;

    return {
      ...domainMeal,
      ingredients: domainMeal.ingredients.map(ing => {
        const starterIng = byName.get(ing.name.toLowerCase());
        if (!starterIng) return ing;
        return {
          ...ing,
          primaryProduct: starterIng.primaryProduct,
          productOptions: starterIng.productOptions,
        };
      }),
    };
  });
}

export async function createMeal(
  meal: Omit<Meal, 'id'> & { userId: string }
): Promise<Meal> {
  const { data: mealRow, error: mealError } = await supabase
    .from('meals')
    .insert({
      user_id: meal.userId,
      name: meal.name,
      tags: meal.tags ?? [],
      prep_time_mins: meal.prepTimeMins ?? null,
      cook_time_mins: meal.cookTimeMins ?? null,
      instructions: meal.instructions,
      source_starter_meal_id: meal.sourceStarterMealId ?? null,
    })
    .select()
    .single();

  if (mealError) throw mealError;

  if (meal.ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('meal_ingredients')
      .insert(
        meal.ingredients.map((ing, idx) => ({
          meal_id: mealRow.id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          store: ing.store ?? null,
          notes: ing.notes ?? null,
          sort_order: idx,
        }))
      );
    if (ingError) throw ingError;
  }

  return getMealById(mealRow.id);
}

export async function updateMeal(meal: Meal): Promise<Meal> {
  const { error: mealError } = await supabase
    .from('meals')
    .update({
      name: meal.name,
      tags: meal.tags ?? [],
      prep_time_mins: meal.prepTimeMins ?? null,
      cook_time_mins: meal.cookTimeMins ?? null,
      instructions: meal.instructions,
    })
    .eq('id', meal.id);

  if (mealError) throw mealError;

  // Replace ingredients: delete existing, re-insert
  const { error: delError } = await supabase
    .from('meal_ingredients')
    .delete()
    .eq('meal_id', meal.id);
  if (delError) throw delError;

  if (meal.ingredients.length > 0) {
    const { error: ingError } = await supabase
      .from('meal_ingredients')
      .insert(
        meal.ingredients.map((ing, idx) => ({
          meal_id: meal.id,
          name: ing.name,
          quantity: ing.quantity ?? null,
          store: ing.store ?? null,
          notes: ing.notes ?? null,
          sort_order: idx,
        }))
      );
    if (ingError) throw ingError;
  }

  return getMealById(meal.id);
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from('meals').delete().eq('id', id);
  if (error) throw error;
}

export async function getMealById(id: string): Promise<Meal> {
  const { data, error } = await supabase
    .from('meals')
    .select('*, meal_ingredients(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return dbMealToDomain(data as DbMeal);
}

/**
 * Copy selected starter meals (and their ingredients) into the current user's
 * meal library. Preserves source_starter_meal_id for traceability.
 */
export async function importStarterMealsForUser(
  starterMealIds: string[],
  userId: string
): Promise<void> {
  if (starterMealIds.length === 0) return;

  const { data, error } = await supabase
    .from('starter_meals')
    .select(`*, starter_meal_ingredients(${STARTER_INGREDIENT_SELECT})`)
    .in('id', starterMealIds);

  if (error) throw error;

  const starterMeals = (data as DbStarterMeal[]).map(dbStarterMealToDomain);

  await Promise.all(
    starterMeals.map(sm =>
      createMeal({
        userId,
        name: sm.name,
        tags: sm.tags,
        ingredients: sm.ingredients,
        instructions: sm.instructions,
        prepTimeMins: sm.prepTimeMins,
        cookTimeMins: sm.cookTimeMins,
        sourceStarterMealId: sm.id,
      })
    )
  );
}

/**
 * Mark the user's onboarding as completed.
 */
export async function completeOnboarding(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ has_completed_onboarding: true })
    .eq('id', userId);
  if (error) throw error;
}
