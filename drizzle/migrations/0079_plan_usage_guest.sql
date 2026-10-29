ALTER TABLE public.wellness_plans DROP CONSTRAINT IF EXISTS wellness_plans_plan_usage_check;
ALTER TABLE public.wellness_plans ADD CONSTRAINT wellness_plans_plan_usage_check CHECK (plan_usage IN ('new','renewal','both','guest'));
UPDATE public.wellness_plans SET plan_usage = 'guest' WHERE name IN ('1st Day Free Trial','Daily Paid');