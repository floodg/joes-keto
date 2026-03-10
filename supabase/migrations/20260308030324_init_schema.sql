begin;

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  calories integer,
  protein_g numeric(10,2),
  fat_g numeric(10,2),
  carbs_g numeric(10,2),
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  notes text,
  target_calories integer,
  target_protein_g numeric(10,2),
  target_fat_g numeric(10,2),
  target_carbs_g numeric(10,2),
  plan_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  food_name text not null,
  meal_type text not null,
  quantity numeric(10,2) not null default 1,
  unit text,
  calories integer,
  protein_g numeric(10,2),
  fat_g numeric(10,2),
  carbs_g numeric(10,2),
  consumed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_entries_meal_type_check
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack'))
);

create index if not exists idx_recipes_user_id
  on public.recipes(user_id);

create index if not exists idx_meal_plans_user_id
  on public.meal_plans(user_id);

create index if not exists idx_meal_plans_plan_date
  on public.meal_plans(plan_date);

create index if not exists idx_meal_entries_meal_plan_id
  on public.meal_entries(meal_plan_id);

create index if not exists idx_meal_entries_recipe_id
  on public.meal_entries(recipe_id);

alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_entries enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "recipes_select_own"
on public.recipes
for select
to authenticated
using (auth.uid() = user_id);

create policy "recipes_insert_own"
on public.recipes
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "recipes_update_own"
on public.recipes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "recipes_delete_own"
on public.recipes
for delete
to authenticated
using (auth.uid() = user_id);

create policy "meal_plans_select_own"
on public.meal_plans
for select
to authenticated
using (auth.uid() = user_id);

create policy "meal_plans_insert_own"
on public.meal_plans
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "meal_plans_update_own"
on public.meal_plans
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meal_plans_delete_own"
on public.meal_plans
for delete
to authenticated
using (auth.uid() = user_id);

create policy "meal_entries_select_own"
on public.meal_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.meal_plans mp
    where mp.id = meal_entries.meal_plan_id
      and mp.user_id = auth.uid()
  )
);

create policy "meal_entries_insert_own"
on public.meal_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.meal_plans mp
    where mp.id = meal_entries.meal_plan_id
      and mp.user_id = auth.uid()
  )
);

create policy "meal_entries_update_own"
on public.meal_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.meal_plans mp
    where mp.id = meal_entries.meal_plan_id
      and mp.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.meal_plans mp
    where mp.id = meal_entries.meal_plan_id
      and mp.user_id = auth.uid()
  )
);

create policy "meal_entries_delete_own"
on public.meal_entries
for delete
to authenticated
using (
  exists (
    select 1
    from public.meal_plans mp
    where mp.id = meal_entries.meal_plan_id
      and mp.user_id = auth.uid()
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_recipes_updated_at
before update on public.recipes
for each row
execute function public.set_updated_at();

create trigger set_meal_plans_updated_at
before update on public.meal_plans
for each row
execute function public.set_updated_at();

create trigger set_meal_entries_updated_at
before update on public.meal_entries
for each row
execute function public.set_updated_at();

commit;