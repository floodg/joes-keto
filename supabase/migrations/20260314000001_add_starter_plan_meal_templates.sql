begin;

-- Starter plan meal templates: definitions copied into user meals at onboarding.
-- Seeded in seed.sql; authenticated users read-only.
create table if not exists public.starter_plan_meal_templates (
  slug        text    primary key,
  name        text    not null,
  tags        text[]  not null default '{}',
  instructions jsonb  not null default '[]'::jsonb
);

alter table public.starter_plan_meal_templates enable row level security;

create policy "starter_plan_meal_templates_select"
  on public.starter_plan_meal_templates
  for select
  to authenticated
  using (true);

commit;
