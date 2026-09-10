ALTER TABLE public.body_measurements
  ADD COLUMN IF NOT EXISTS weight numeric,
  ADD COLUMN IF NOT EXISTS trunk_fat numeric,
  ADD COLUMN IF NOT EXISTS muscle_mass numeric,
  ADD COLUMN IF NOT EXISTS visceral_fat numeric,
  ADD COLUMN IF NOT EXISTS bmr numeric,
  ADD COLUMN IF NOT EXISTS bmi numeric,
  ADD COLUMN IF NOT EXISTS body_age integer,
  ADD COLUMN IF NOT EXISTS ideal_weight numeric,
  ADD COLUMN IF NOT EXISTS remark text;