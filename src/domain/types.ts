// Domain types for Joe's Keto

export interface StoreProduct {
  id: string;
  name: string;
  brand?: string;
  sizeLabel?: string;
  store: string;
  productUrl: string;
  imageUrl?: string;
  createdAt: string;
}

export interface MealIngredientProduct {
  id: string;
  name: string;
  brand?: string;
  sizeLabel?: string;
  store: string;
  productUrl: string;
  imageUrl?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string;
  store?: string;
  notes?: string;
  /** Primary linked store product */
  primaryProduct?: MealIngredientProduct;
  /** Alternative product options */
  productOptions?: MealIngredientProduct[];
}

export interface Meal {
  id: string;
  name: string;
  tags?: string[];
  ingredients: Ingredient[];
  instructions: string[];
  prepTimeMins?: number;
  cookTimeMins?: number;
  /** Set when the meal was imported from a starter meal template */
  sourceStarterMealId?: string;
}

export interface StarterMeal {
  id: string;
  slug: string;
  name: string;
  description?: string;
  tags: string[];
  prepTimeMins?: number;
  cookTimeMins?: number;
  instructions: string[];
  ingredients: Ingredient[];
}

export type MealTime = "breakfast" | "lunch" | "dinner" | "snack";

export interface PlannedMeal {
  id: string;
  date: string; // YYYY-MM-DD
  time: MealTime;
  mealId: string;
  notes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  sets?: number;
  reps?: string;
  load?: string;
  notes?: string;
}

export interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
}

export interface PlannedWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  workoutId: string;
  time?: string;
  notes?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: string;
  store?: string;
  checked?: boolean;
  manual?: boolean; // true if manually added, false if from meal plan
}

export interface ProgramContent {
  daily_structure?: {
    morning?: string;
    lunch?: string;
    dinner?: string;
    protein_target?: string;
  };
  weekly_structure?: {
    fast_days?: number;
    standard_days?: number;
    description?: string;
  };
  walking?: {
    frequency?: string;
    duration?: string;
  };
  strength_training?: {
    days?: number;
    schedule?: string[];
    exercises?: string[];
  };
}

export interface Program {
  id: string;
  title: string;
  description?: string;
  category?: string;
  content?: ProgramContent;
  createdAt: string;
}

export interface UserProgram {
  id: string;
  userId: string;
  programId: string;
  program?: Program;
  createdAt: string;
}

export type InventoryTransactionType = 'purchase' | 'meal_consumption' | 'waste' | 'manual_adjustment';

export interface InventoryTransaction {
  id: string;
  userId: string;
  ingredientName: string;
  quantityDelta: number;
  unit?: string;
  transactionType: InventoryTransactionType;
  sourceType?: string;
  sourceId?: string;
  occurredAt: string;
  createdAt: string;
export interface ShoppingTripItem {
  id: string;
  shoppingTripId: string;
  productName: string;
  quantityPurchased: number;
  packQuantity?: number;
  packUnit?: string;
  createdAt: string;
}

export interface ShoppingTrip {
  id: string;
  userId: string;
  store: string;
  purchasedAt: string; // ISO timestamptz
  notes?: string;
  createdAt: string;
  items: ShoppingTripItem[];
}
