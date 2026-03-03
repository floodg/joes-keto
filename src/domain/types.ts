// Domain types for Joe's Keto

export interface Ingredient {
  id: string;
  name: string;
  quantity?: string;
  store?: string;
  notes?: string;
}

export interface Meal {
  id: string;
  name: string;
  tags?: string[];
  ingredients: Ingredient[];
  instructions: string[];
  prepTimeMins?: number;
  cookTimeMins?: number;
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
