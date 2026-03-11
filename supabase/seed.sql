-- Seed starter meals (idempotent – uses ON CONFLICT DO NOTHING on slug)

insert into public.starter_meals (slug, name, description, tags, prep_time_mins, cook_time_mins, instructions)
values
  (
    'black-coffee-water',
    'Black Coffee / Water',
    'Start the morning with black coffee or water. No calories – ideal for skipped meals or intermittent fasting.',
    array['keto', 'morning', 'fasting'],
    0,
    0,
    '["Brew black coffee (no milk, sugar, or cream) or prepare cold water.",
      "No calories if not hungry – keep it clean.",
      "Aim for 3–4L of water throughout the day."]'::jsonb
  ),
  (
    'joes-keto-pizza',
    'Joe''s Keto Pizza (Fathead / Almond Flour)',
    'Classic fathead dough keto pizza – crispy, cheesy, and low carb.',
    array['keto', 'pizza', 'fathead'],
    15,
    22,
    '["Melt mozzarella and cream cheese together (microwave in 30-second bursts, stirring each time).",
      "Mix in almond meal, baking powder, garlic powder, and salt until combined.",
      "Add the egg and work into a dough.",
      "Roll dough out between two sheets of baking paper into a pizza shape.",
      "Pre-bake at 200°C for 10–12 minutes until golden.",
      "Add tomato paste and extra mozzarella plus desired toppings.",
      "Bake for a further 8–10 minutes until cheese is melted and bubbly."]'::jsonb
  ),
  (
    '250g-mince-taco-bowl',
    '250g Mince Taco Bowl',
    'Hearty keto taco bowl with seasoned beef mince over fresh lettuce.',
    array['keto', 'mince', 'taco'],
    5,
    10,
    '["Cook beef mince in a pan over medium-high heat until browned.",
      "Season with taco spices (cumin, paprika, garlic powder, chilli) to taste.",
      "Assemble over a bed of shredded lettuce.",
      "Top with shredded cheese, sour cream, sliced avocado, and salsa."]'::jsonb
  ),
  (
    'salmon-salad',
    'Salmon Salad',
    'Light, refreshing keto salmon salad with crisp vegetables and olive oil dressing.',
    array['keto', 'salad', 'salmon'],
    10,
    10,
    '["Season salmon fillet with salt and pepper.",
      "Pan-fry or grill salmon for 4–5 minutes each side until cooked through.",
      "Chop lettuce, cucumber, cherry tomatoes, and red onion.",
      "Slice avocado.",
      "Assemble salad and place salmon on top.",
      "Drizzle with olive oil dressing and serve immediately."]'::jsonb
  )
on conflict (slug) do nothing;

-- Seed starter meal ingredients

-- Black Coffee / Water (no ingredients needed – intentionally empty)

-- Joe's Keto Pizza
with pizza as (
  select id from public.starter_meals where slug = 'joes-keto-pizza'
)
insert into public.starter_meal_ingredients (starter_meal_id, name, quantity, store, sort_order)
select
  pizza.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from pizza,
(values
  ('Mozzarella cheese',       '1.5 cups',   0),
  ('Cream cheese',            '2 tbsp',     1),
  ('Almond meal',             '0.75 cup',   2),
  ('Egg',                     '1',          3),
  ('Baking powder',           '0.5 tsp',    4),
  ('Garlic powder',           '0.5 tsp',    5),
  ('Salt',                    'pinch',      6),
  ('Tomato paste',            '1–2 tbsp',   7),
  ('Extra mozzarella (top)',  'to taste',   8)
) as ing(name, quantity, sort_order)
where not exists (
  select 1 from public.starter_meal_ingredients smi
  where smi.starter_meal_id = pizza.id
);

-- 250g Mince Taco Bowl
with taco as (
  select id from public.starter_meals where slug = '250g-mince-taco-bowl'
)
insert into public.starter_meal_ingredients (starter_meal_id, name, quantity, store, sort_order)
select
  taco.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from taco,
(values
  ('Beef mince',   '250g',        0),
  ('Lettuce',      '1 serving',   1),
  ('Cheese',       '30g',         2),
  ('Sour cream',   '2 tbsp',      3),
  ('Avocado',      '0.5',         4),
  ('Salsa',        'optional',    5)
) as ing(name, quantity, sort_order)
where not exists (
  select 1 from public.starter_meal_ingredients smi
  where smi.starter_meal_id = taco.id
);

-- Salmon Salad
with salmon as (
  select id from public.starter_meals where slug = 'salmon-salad'
)
insert into public.starter_meal_ingredients (starter_meal_id, name, quantity, store, sort_order)
select
  salmon.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from salmon,
(values
  ('Salmon fillet',      '1 serving',  0),
  ('Lettuce',            '1 serving',  1),
  ('Cucumber',           '0.5',        2),
  ('Cherry tomatoes',    '4–6',        3),
  ('Red onion',          'small',      4),
  ('Avocado',            '0.5',        5),
  ('Olive oil dressing', 'to serve',   6)
) as ing(name, quantity, sort_order)
where not exists (
  select 1 from public.starter_meal_ingredients smi
  where smi.starter_meal_id = salmon.id
);
