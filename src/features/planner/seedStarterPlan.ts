import { supabase } from '../../lib/supabase';

// ─── Weekly schedule ──────────────────────────────────────────────────────────
// Slugs match starter_plan_meal_templates in DB (seed.sql). Monday = index 0 … Sunday = index 6.
// Lunch: Taco Bowl every day except Friday (Salmon – no meat). Dinner: rotation; Friday seafood only.
interface DaySchedule {
  breakfast: string;
  lunch: string;
  dinner: string;
  snack: string;
  dinnerNotes?: string;
}

const WEEKLY_SCHEDULE: DaySchedule[] = [
  { breakfast: 'morning', lunch: 'mince_taco_bowl', dinner: 'steak_greens', snack: 'daily_targets' }, // Mon
  { breakfast: 'morning', lunch: 'mince_taco_bowl', dinner: 'chicken_avocado_salad', snack: 'daily_targets' }, // Tue
  { breakfast: 'morning', lunch: 'mince_taco_bowl', dinner: 'mince_bowl', snack: 'daily_targets' }, // Wed
  { breakfast: 'morning', lunch: 'mince_taco_bowl', dinner: 'steak_greens', snack: 'daily_targets' }, // Thu
  { breakfast: 'morning', lunch: 'salmon_salad', dinner: 'salmon_avocado_salad', snack: 'daily_targets' }, // Fri – no meat
  { breakfast: 'morning', lunch: 'mince_taco_bowl', dinner: 'mince_bowl', snack: 'daily_targets' }, // Sat
  {
    breakfast: 'morning',
    lunch: 'mince_taco_bowl',
    dinner: 'chicken_avocado_salad',
    snack: 'daily_targets',
    dinnerNotes: 'Keep structure, then return to plan next meal',
  }, // Sun
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOfCurrentWeek(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, …
  // Shift back to Monday; setUTCDate handles negative values and month boundaries correctly
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

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

  // ── Step 1: load templates from DB and create user meals ───────────────────
  const { data: templates, error: templatesError } = await supabase
    .from('starter_plan_meal_templates')
    .select('slug, name, tags, instructions')
    .order('slug');

  if (templatesError) throw templatesError;
  if (!templates?.length) return;

  const mealIds: Record<string, string> = {};

  for (const row of templates) {
    const instructions = Array.isArray(row.instructions) ? row.instructions : [];
    const { data, error } = await supabase
      .from('meals')
      .insert({
        user_id: userId,
        name: row.name,
        tags: row.tags ?? [],
        instructions,
      })
      .select('id')
      .single();

    if (error) throw error;
    mealIds[row.slug] = (data as { id: string }).id;
  }

  // ── Step 2: build planned_meals rows for 4 weeks (next month) ────────────
  const monday = getMondayOfCurrentWeek(new Date());
  const WEEKS_TO_SEED = 4;

  const rows = Array.from({ length: WEEKS_TO_SEED }, (_, week) =>
    WEEKLY_SCHEDULE.flatMap((schedule, dayIndex) => {
      const date = new Date(monday);
      date.setUTCDate(date.getUTCDate() + week * 7 + dayIndex);
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
    })
  ).flat();

  const { error: insertError } = await supabase
    .from('planned_meals')
    .insert(rows);

  if (insertError) throw insertError;
}
