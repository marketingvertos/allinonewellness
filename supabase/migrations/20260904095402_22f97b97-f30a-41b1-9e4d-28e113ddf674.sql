
CREATE UNIQUE INDEX IF NOT EXISTS wellness_notification_templates_trigger_channel_key
  ON public.wellness_notification_templates (trigger_key, channel);

INSERT INTO public.wellness_notification_templates
  (trigger_key, channel, active, message_template, template_name, template_language, variables, created_by)
SELECT v.trigger_key, 'whatsapp', true, v.message_template, v.template_name, 'en', v.variables,
       (SELECT created_by FROM public.wellness_notification_templates WHERE created_by IS NOT NULL LIMIT 1)
FROM (VALUES
  ('checkin_approved',
   E'Hi {{name}}, your attendance at All In One Wellness on {{date}} is confirmed.\nToday''s weight: {{weight}} kg ({{weight_change}} since you started).\nServings used today: 1. Servings left: {{remaining}}.\nPlan valid till: {{end_date}}.\nKeep going — see you at your next session!',
   'checkin_confirmation',
   '["name","date","weight","weight_change","remaining","end_date"]'::jsonb),
  ('serving_balance',
   E'Hi {{name}}, you have only {{remaining}} servings left in your plan (valid till {{end_date}}).\nPlease contact your coach to renew and keep your progress going.',
   'serving_balance_alert',
   '["name","remaining","end_date"]'::jsonb),
  ('renewal_due',
   E'Hi {{name}}, your plan {{code}} is valid till {{end_date}} and you have {{remaining}} servings left.\nPlease contact your coach to renew and keep your progress going.',
   'serving_balance_alert',
   '["name","remaining","end_date"]'::jsonb)
) AS v(trigger_key, message_template, template_name, variables)
ON CONFLICT (trigger_key, channel) DO UPDATE
SET message_template = EXCLUDED.message_template,
    template_name = EXCLUDED.template_name,
    template_language = EXCLUDED.template_language,
    variables = EXCLUDED.variables,
    active = true,
    updated_at = now();

UPDATE public.wellness_notification_templates
SET template_name = 'serving_balance_alert',
    template_language = 'en',
    variables = '["name","remaining","end_date"]'::jsonb,
    message_template = E'Hi {{name}}, you have only {{remaining}} servings left in your plan (valid till {{end_date}}).\nPlease contact your coach to renew and keep your progress going.'
WHERE channel = 'whatsapp' AND trigger_key LIKE 'serving\_balance\_%';
