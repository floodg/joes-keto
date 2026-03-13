-- ─────────────────────────────────────────────────────────────────────────────
-- Seed store products (Coles)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.store_products (id, name, brand, size_label, store, product_url)
values
  (
    '11111111-0001-0001-0001-000000000001',
    'Coles Mozzarella Cheese',
    'Coles',
    '500g',
    'Coles',
    'https://www.coles.com.au/product/coles-mozzarella-cheese-500g-1234501'
  ),
  (
    '11111111-0001-0001-0001-000000000002',
    'Bulla Mozzarella Cheese',
    'Bulla',
    '250g',
    'Coles',
    'https://www.coles.com.au/product/bulla-mozzarella-cheese-250g-1234502'
  ),
  (
    '11111111-0001-0001-0001-000000000003',
    'Coles Cream Cheese',
    'Coles',
    '250g',
    'Coles',
    'https://www.coles.com.au/product/coles-cream-cheese-250g-1234503'
  ),
  (
    '11111111-0001-0001-0001-000000000004',
    'Philadelphia Cream Cheese',
    'Philadelphia',
    '250g',
    'Coles',
    'https://www.coles.com.au/product/philadelphia-cream-cheese-250g-1234504'
  ),
  (
    '11111111-0001-0001-0001-000000000005',
    'Macro Almond Meal',
    'Macro',
    '400g',
    'Coles',
    'https://www.coles.com.au/product/macro-almond-meal-400g-1234505'
  ),
  (
    '11111111-0001-0001-0001-000000000006',
    'Coles Almond Meal',
    'Coles',
    '300g',
    'Coles',
    'https://www.coles.com.au/product/coles-almond-meal-300g-1234506'
  ),
  (
    '11111111-0001-0001-0001-000000000007',
    'Almond Meal Natural',
    'Honest to Goodness',
    '400g',
    'Coles',
    'https://www.coles.com.au/product/almond-meal-400g-1234507'
  ),
  (
    '11111111-0001-0001-0001-000000000008',
    'Coles Beef Mince',
    'Coles',
    '500g',
    'Coles',
    'https://www.coles.com.au/product/coles-beef-mince-500g-1234508'
  ),
  (
    '11111111-0001-0001-0001-000000000009',
    'Coles Atlantic Salmon Fillet',
    'Coles',
    '400g',
    'Coles',
    'https://www.coles.com.au/product/coles-atlantic-salmon-fillet-400g-1234509'
  ),
  (
    '11111111-0001-0001-0001-000000000010',
    'Coles Tomato Paste',
    'Coles',
    '140g',
    'Coles',
    'https://www.coles.com.au/product/coles-tomato-paste-140g-1234510'
  )
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
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
insert into public.starter_meal_ingredients (id, starter_meal_id, name, quantity, store, sort_order)
select
  ing.ingredient_id,
  pizza.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from pizza,
(values
  ('aaaaaaaa-0001-0001-0001-000000000001'::uuid, 'Mozzarella cheese',       '1.5 cups',   0),
  ('aaaaaaaa-0001-0001-0001-000000000002'::uuid, 'Cream cheese',            '2 tbsp',     1),
  ('aaaaaaaa-0001-0001-0001-000000000003'::uuid, 'Almond meal',             '0.75 cup',   2),
  ('aaaaaaaa-0001-0001-0001-000000000004'::uuid, 'Egg',                     '1',          3),
  ('aaaaaaaa-0001-0001-0001-000000000005'::uuid, 'Baking powder',           '0.5 tsp',    4),
  ('aaaaaaaa-0001-0001-0001-000000000006'::uuid, 'Garlic powder',           '0.5 tsp',    5),
  ('aaaaaaaa-0001-0001-0001-000000000007'::uuid, 'Salt',                    'pinch',      6),
  ('aaaaaaaa-0001-0001-0001-000000000008'::uuid, 'Tomato paste',            '1–2 tbsp',   7),
  ('aaaaaaaa-0001-0001-0001-000000000009'::uuid, 'Extra mozzarella (top)',  'to taste',   8)
) as ing(ingredient_id, name, quantity, sort_order)
on conflict (id) do nothing;

-- Link primary products to pizza ingredients
update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000001'
  where id = 'aaaaaaaa-0001-0001-0001-000000000001'; -- Mozzarella cheese

update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000003'
  where id = 'aaaaaaaa-0001-0001-0001-000000000002'; -- Cream cheese

update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000006'
  where id = 'aaaaaaaa-0001-0001-0001-000000000003'; -- Almond meal (Coles brand is default)

update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000010'
  where id = 'aaaaaaaa-0001-0001-0001-000000000008'; -- Tomato paste

update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000001'
  where id = 'aaaaaaaa-0001-0001-0001-000000000009'; -- Extra mozzarella (top)

-- Almond meal alternative products
insert into public.starter_meal_ingredient_product_options
  (starter_meal_ingredient_id, store_product_id, sort_order)
values
  ('aaaaaaaa-0001-0001-0001-000000000003', '11111111-0001-0001-0001-000000000005', 0),
  ('aaaaaaaa-0001-0001-0001-000000000003', '11111111-0001-0001-0001-000000000007', 1)
on conflict (starter_meal_ingredient_id, store_product_id) do nothing;

-- Mozzarella cheese alternative product
insert into public.starter_meal_ingredient_product_options
  (starter_meal_ingredient_id, store_product_id, sort_order)
values
  ('aaaaaaaa-0001-0001-0001-000000000001', '11111111-0001-0001-0001-000000000002', 0)
on conflict (starter_meal_ingredient_id, store_product_id) do nothing;

-- Cream cheese alternative product
insert into public.starter_meal_ingredient_product_options
  (starter_meal_ingredient_id, store_product_id, sort_order)
values
  ('aaaaaaaa-0001-0001-0001-000000000002', '11111111-0001-0001-0001-000000000004', 0)
on conflict (starter_meal_ingredient_id, store_product_id) do nothing;

-- 250g Mince Taco Bowl
with taco as (
  select id from public.starter_meals where slug = '250g-mince-taco-bowl'
)
insert into public.starter_meal_ingredients (id, starter_meal_id, name, quantity, store, sort_order)
select
  ing.ingredient_id,
  taco.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from taco,
(values
  ('bbbbbbbb-0001-0001-0001-000000000001'::uuid, 'Beef mince',   '250g',        0),
  ('bbbbbbbb-0001-0001-0001-000000000002'::uuid, 'Lettuce',      '1 serving',   1),
  ('bbbbbbbb-0001-0001-0001-000000000003'::uuid, 'Cheese',       '30g',         2),
  ('bbbbbbbb-0001-0001-0001-000000000004'::uuid, 'Sour cream',   '2 tbsp',      3),
  ('bbbbbbbb-0001-0001-0001-000000000005'::uuid, 'Avocado',      '0.5',         4),
  ('bbbbbbbb-0001-0001-0001-000000000006'::uuid, 'Salsa',        'optional',    5)
) as ing(ingredient_id, name, quantity, sort_order)
on conflict (id) do nothing;

-- Link primary product to taco beef mince
update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000008'
  where id = 'bbbbbbbb-0001-0001-0001-000000000001'; -- Beef mince

-- Salmon Salad
with salmon as (
  select id from public.starter_meals where slug = 'salmon-salad'
)
insert into public.starter_meal_ingredients (id, starter_meal_id, name, quantity, store, sort_order)
select
  ing.ingredient_id,
  salmon.id,
  ing.name,
  ing.quantity,
  'Coles',
  ing.sort_order
from salmon,
(values
  ('cccccccc-0001-0001-0001-000000000001'::uuid, 'Salmon fillet',      '1 serving',  0),
  ('cccccccc-0001-0001-0001-000000000002'::uuid, 'Lettuce',            '1 serving',  1),
  ('cccccccc-0001-0001-0001-000000000003'::uuid, 'Cucumber',           '0.5',        2),
  ('cccccccc-0001-0001-0001-000000000004'::uuid, 'Cherry tomatoes',    '4–6',        3),
  ('cccccccc-0001-0001-0001-000000000005'::uuid, 'Red onion',          'small',      4),
  ('cccccccc-0001-0001-0001-000000000006'::uuid, 'Avocado',            '0.5',        5),
  ('cccccccc-0001-0001-0001-000000000007'::uuid, 'Olive oil dressing', 'to serve',   6)
) as ing(ingredient_id, name, quantity, sort_order)
on conflict (id) do nothing;

-- Link primary product to salmon fillet
update public.starter_meal_ingredients
  set store_product_id = '11111111-0001-0001-0001-000000000009'
  where id = 'cccccccc-0001-0001-0001-000000000001'; -- Salmon fillet
