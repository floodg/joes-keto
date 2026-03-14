import { supabase } from '../../lib/supabase';
import { formatDateLocal, getMondayLocal } from '../../lib/dateUtils';

// ─── Meal definitions ─────────────────────────────────────────────────────────

interface StarterMealDef {
  name: string;
  tags: string[];
  instructions: string[];
}

const STARTER_MEAL_DEFS: Record<string, StarterMealDef> = {
  morning: {
    name: 'Morning: Black Coffee / Water',
    tags: ['starter_joes_keto'],
    instructions: [
      'Black coffee or water',
      'No calories if not hungry',
      '3–4L water goal throughout the day',
    ],
  },
  minceTacoBowl: {
    name: '250g Mince Taco Bowl',
    tags: ['starter_joes_keto', 'high-protein'],
    instructions: ['High-protein anchor meal (Meal 1 · 12–2pm)'],
  },
  salmonSalad: {
    name: 'Salmon + Salad',
    tags: ['starter_joes_keto', 'high-protein', 'no-meat'],
    instructions: ['High-protein anchor meal (Meal 1 · 12–2pm) · No meat'],
  },
  steakGreens: {
    name: 'Steak + Greens',
    tags: ['starter_joes_keto', 'protein-focused'],
    instructions: ['Protein-focused dinner (Meal 2 · 6–7pm)'],
  },
  chickenAvocadoSalad: {
    name: 'Chicken + Avocado Salad',
    tags: ['starter_joes_keto', 'protein-focused'],
    instructions: ['Protein-focused dinner (Meal 2 · 6–7pm)'],
  },
  minceBowl: {
    name: 'Mince Bowl',
    tags: ['starter_joes_keto', 'protein-focused'],
    instructions: ['Protein-focused dinner (Meal 2 · 6–7pm)'],
  },
  // Friday dinner: fish-based to observe the Friday meat abstinence
  salmonAvocadoSalad: {
    name: 'Salmon + Avocado Salad',
    tags: ['starter_joes_keto', 'protein-focused', 'no-meat'],
    instructions: ['Protein-focused dinner (Meal 2 · 6–7pm) · No meat'],
  },
  dailyTargets: {
    name: 'Daily Targets',
    tags: ['starter_joes_keto'],
    instructions: [
      'Protein: 160–190g',
      'Carbs: under 50g',
      'Calories: 2300–2600',
      'Steps: 7–10k',
      'No liquid calories',
      'No random grazing',
      'No late snacking',
    ],
  },
};

// ─── Weekly schedule ──────────────────────────────────────────────────────────

interface DaySchedule {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
  dinnerNotes?: string;
}

// Monday = index 0 … Sunday = index 6
// Lunch rule: Taco Bowl every day except Friday (Salmon – no meat)
// Dinner rule: rotation of remaining meals; Friday must be seafood only
const WEEKLY_SCHEDULE: DaySchedule[] = [
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'steakGreens',         snack: 'dailyTargets' }, // Mon
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'chickenAvocadoSalad', snack: 'dailyTargets' }, // Tue
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'minceBowl',           snack: 'dailyTargets' }, // Wed
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'steakGreens',         snack: 'dailyTargets' }, // Thu
  { breakfast: 'morning', lunch: 'salmonSalad',     dinner: 'salmonAvocadoSalad',  snack: 'dailyTargets' }, // Fri – no meat
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'minceBowl',           snack: 'dailyTargets' }, // Sat
  {                                                                                                           // Sun
    breakfast: 'morning',
    lunch: 'minceTacoBowl',
    dinner: 'chickenAvocadoSalad',
    snack: 'dailyTargets',
    dinnerNotes: 'Keep structure, then return to plan next meal',
  },
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Seeds a default Joe's Keto meal plan for a newly signed-up user,
 * covering the next month (4 weeks starting from Monday of the current week).
 *
 * - Idempotent: if any meals tagged `starter_joes_keto` already exist for
 *   this user the function returns immediately without inserting duplicates.
 * - Breakfast every day: Black Coffee / Water.
 * - Lunch every day: 250g Mince Taco Bowl, except Fridays which use Salmon + Salad
 *   (no meat, adherence to Friday abstinence rule).
 * - Dinner: rotating selection of keto meals; Friday dinner is always seafood only.
 */
export async function seedStarterPlan(userId: string): Promise<void> {
  // ── Idempotency check ────────────────────────────────────────────────────
  const { data: existing, error: checkError } = await supabase
    .from('meals')
    .select('id')
    .eq('user_id', userId)
    .contains('tags', ['starter_joes_keto'])
    .limit(1);

  if (checkError) throw checkError;
  if (existing && existing.length > 0) return;

  // ── Step 1: create all unique starter meals in the user's meal library ───
  const mealIds: Record<string, string> = {};

  for (const [key, def] of Object.entries(STARTER_MEAL_DEFS)) {
    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        name: def.name,
        tags: def.tags,
        instructions: def.instructions,
      })
      .select('id')
      .single();

    if (error) throw error;
    mealIds[key] = (data as { id: string }).id;
  }

  // ── Step 2: build planned_meals rows for 4 weeks (next month) ────────────
  const monday = getMondayLocal(new Date());
  const WEEKS_TO_SEED = 4;

  const rows = Array.from({ length: WEEKS_TO_SEED }, (_, week) =>
    WEEKLY_SCHEDULE.flatMap((schedule, dayIndex) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + week * 7 + dayIndex);
      const dateStr = formatDateLocal(date);

      return [
        {
          user_id: userId,
          meal_id: mealIds[schedule.breakfast],
          planned_date: dateStr,
          meal_slot: 'breakfast',
          notes: null,
        },
        {
          user_id: userId,
          meal_id: mealIds[schedule.lunch],
          planned_date: dateStr,
          meal_slot: 'lunch',
          notes: null,
        },
        {
          user_id: userId,
          meal_id: mealIds[schedule.dinner],
          planned_date: dateStr,
          meal_slot: 'dinner',
          notes: schedule.dinnerNotes ?? null,
        },
        {
          user_id: userId,
          meal_id: mealIds[schedule.snack],
          planned_date: dateStr,
          meal_slot: 'snack',
          notes: null,
        },
      ];
    })
  ).flat();

  const { error: insertError } = await supabase
    .from('planned_meals')
    .insert(rows);

  if (insertError) throw insertError;
}
