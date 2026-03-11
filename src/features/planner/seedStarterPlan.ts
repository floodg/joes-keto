import { supabase } from '../../lib/supabase';

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
    tags: ['starter_joes_keto', 'high-protein'],
    instructions: ['High-protein anchor meal (Meal 1 · 12–2pm)'],
  },
  eggsSausage: {
    name: '3–4 Eggs + Sausage',
    tags: ['starter_joes_keto', 'high-protein'],
    instructions: ['High-protein anchor meal (Meal 1 · 12–2pm)'],
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
const WEEKLY_SCHEDULE: DaySchedule[] = [
  { breakfast: 'morning', lunch: 'minceTacoBowl',  dinner: 'steakGreens',         snack: 'dailyTargets' }, // Mon
  { breakfast: 'morning', lunch: 'salmonSalad',     dinner: 'chickenAvocadoSalad', snack: 'dailyTargets' }, // Tue
  { breakfast: 'morning', lunch: 'eggsSausage',     dinner: 'minceBowl',           snack: 'dailyTargets' }, // Wed
  { breakfast: 'morning', lunch: 'minceTacoBowl',   dinner: 'steakGreens',         snack: 'dailyTargets' }, // Thu
  { breakfast: 'morning', lunch: 'salmonSalad',     dinner: 'salmonAvocadoSalad',  snack: 'dailyTargets' }, // Fri – no meat dinner
  { breakfast: 'morning', lunch: 'eggsSausage',     dinner: 'minceBowl',           snack: 'dailyTargets' }, // Sat
  {                                                                                                           // Sun
    breakfast: 'morning',
    lunch: 'minceTacoBowl',
    dinner: 'steakGreens',
    snack: 'dailyTargets',
    dinnerNotes: 'Keep structure, then return to plan next meal',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfCurrentWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, …
  // Shift back to Monday; setDate handles negative values and month boundaries correctly
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Seeds a default Joe's Keto weekly meal plan for a newly signed-up user.
 *
 * - Idempotent: if any meals tagged `starter_joes_keto` already exist for
 *   this user the function returns immediately without inserting duplicates.
 * - Populates the week that contains the current calendar day (Mon–Sun).
 * - Friday dinner uses a fish-based meal to observe the Friday abstinence rule.
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

  // ── Step 2: build planned_meals rows for Mon–Sun of the current week ─────
  const monday = getMondayOfCurrentWeek(new Date());

  const rows = WEEKLY_SCHEDULE.flatMap((schedule, i) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const dateStr = formatDate(date);

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
  });

  const { error: insertError } = await supabase
    .from('planned_meals')
    .insert(rows);

  if (insertError) throw insertError;
}
