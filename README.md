# 🥑 Joe's Keto

A React-based meal planning and workout tracking app for keto lifestyle management. Track meals, plan your week, manage workouts, and generate shopping lists automatically. All meal and planning data is persisted in **Supabase** (PostgreSQL).

## Features

- 🍽️ **Meal Management**: Create and manage keto recipes with ingredients and instructions
- 📅 **Weekly Planner**: Visual calendar to plan meals by day and time
- 💪 **Workout Tracker**: Create workout templates and schedule training sessions (localStorage for now)
- 🛒 **Smart Shopping List**: Auto-generates shopping lists from your DB-backed meal plan
- 🌱 **Starter Meals**: New users can import predefined keto meals on first login
- 🔐 **Auth + RLS**: Supabase Auth with Row Level Security – users only see their own data

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm install -g supabase`)
- Docker (for local Supabase)

### Installation

```bash
# Clone the repository
git clone https://github.com/laidbacknet/joes-keto.git
cd joes-keto

# Install dependencies
npm install

# Copy environment file and fill in your Supabase URL + anon key
cp .env.local.example .env.local
```

### Local Supabase Setup

```bash
# Start local Supabase (requires Docker)
supabase start

# Run all migrations
supabase db reset
# or to apply new migrations incrementally:
supabase migration up

# Seed starter meals
supabase db seed
# or manually:
psql "$(supabase status --output json | jq -r '.DB_URL')" -f supabase/seed.sql
```

The local Supabase Studio is available at **http://localhost:54323**.

### Start the App

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## Database Migrations

Migrations live in `supabase/migrations/` and are applied in timestamp order.

| Migration | Purpose |
|-----------|---------|
| `20260308030324_init_schema.sql` | Initial schema: profiles, recipes, meal_plans, meal_entries |
| `20260308_add_profile_trigger.sql` | Auto-create profile on signup |
| `20260310000001_meals_planner_schema.sql` | Add starter_meals, meals, meal_ingredients, planned_meals tables + RLS |
| `20260315000001_ingredient_model_upgrade.sql` | Structured ingredient quantities + ingredient catalog (pantry flags) |
| `20260315000004_pantry_inventory.sql` | Pantry inventory tracking + pantry_add_stock RPC |
| `20260315000005_shopping_list.sql` | Shopping list with RLS and unique unpurchased index |
| `20260315000006_add_planned_meals_eaten_at.sql` | Add eaten_at timestamp to planned_meals |
| `20260315000007_mark_meal_eaten.sql` | Atomic engine to deduct pantry and mark meal completed |

## Seed Data

`supabase/seed.sql` inserts three starter keto meals into `starter_meals`:

- **Joe's Keto Pizza** (Fathead / Almond Flour)
- **250g Mince Taco Bowl**
- **Salmon Salad**

The seed is idempotent (uses `ON CONFLICT (slug) DO NOTHING`).

Run seed:
```bash
supabase db seed
```

## Onboarding Flow

1. After a new user signs up, they are redirected to `/onboarding`.
2. The onboarding page fetches starter meals from Supabase and displays them as selectable cards.
3. The user selects which meals to import (all pre-selected by default) and clicks **Import**.
4. Selected starter meals (and their ingredients) are copied into the user's `meals` and `meal_ingredients` tables, with `source_starter_meal_id` set for traceability.
5. `profiles.has_completed_onboarding` is set to `true`.
6. The user is redirected to the **Meals** page.

Returning users with `has_completed_onboarding = true` bypass the onboarding screen automatically.

## Tech Stack

- **React 19** with TypeScript
- **Vite 7** for fast development and building
- **React Router** for navigation
- **Supabase** (PostgreSQL + Auth + RLS) for data persistence

## Project Structure

```
src/
├── app/              # App layout and routing
├── context/          # AuthProvider (session + profile)
├── domain/           # TypeScript types
├── features/
│   ├── Dashboard.tsx          # Today's plan overview
│   ├── meals/
│   │   ├── api.ts             # Supabase API: meals + starter meals
│   │   └── MealsPage.tsx      # Meal CRUD
│   ├── plan/
│   │   ├── PlanPage.tsx       # Weekly meal planner
│   │   └── api.ts             # Supabase API: planned meals
│   ├── onboarding/
│   │   └── StarterMealsPage.tsx # First-run starter meal selection
│   ├── workouts/              # Workout CRUD (localStorage)
│   └── shopping/              # Shopping list
├── lib/
│   └── supabase.ts   # Supabase client
└── storage/          # Legacy localStorage (workouts only for now)
```

## Development

```bash
# Run dev server
npm run dev

# Build
npm run build

# Lint
npm run lint
```

## License

MIT

## Ingredient Consumption Engine (Phase 3)

Marking a planned meal as completed now triggers an atomic Postgres RPC:

```ts
const { error } = await supabase.rpc('mark_meal_eaten', {
  p_planned_meal_id: plannedMealId,
  p_user_id: user.id,
});
```

Behavior:
- Skips pantry staples.
- Deducts `pantry_inventory.consumed_qty` per (ingredient, unit), capped at `purchased_qty`.
- Auto-upserts to `shopping_list` (`source = 'auto_pantry'`) when stock hits zero and `auto_reorder = true` (idempotent).
- Sets `planned_meals.status = 'completed'` and `eaten_at = now()`.

