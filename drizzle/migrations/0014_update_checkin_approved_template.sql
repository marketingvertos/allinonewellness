UPDATE public.wellness_notification_templates
SET message_template = 'Hi {{name}}, your attendance at All In One Wellness on {{date}} is confirmed.

Today''s weight: {{weight}} kg ({{weight_change}} since you started).

Change from last reading: {{daily_change}} (last: {{last_weight}} kg).

Servings used today: 1. Servings left: {{remaining}}.

Plan valid till: {{end_date}}.

Keep going — see you at your next session!

Team All In One Wellness',
    variables = '["name","date","weight","weight_change","daily_change","last_weight","remaining","end_date"]'::jsonb,
    template_name = 'checkin_approved_v2',
    template_language = 'en',
    updated_at = now()
WHERE trigger_key = 'checkin_approved' AND channel = 'whatsapp';