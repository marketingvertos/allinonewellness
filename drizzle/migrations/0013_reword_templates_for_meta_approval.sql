UPDATE public.wellness_notification_templates SET message_template =
  'Hi {{name}}, your membership {{code}} is now active at All In One Wellness and is valid until {{end_date}}. Visit the club any day to use your servings.'
WHERE trigger_key = 'membership_activated' AND channel = 'whatsapp';

UPDATE public.wellness_notification_templates SET message_template =
  'Hi {{name}}, your plan has been changed to {{plan_name}} at All In One Wellness. You now have {{remaining}} servings and the plan is valid till {{end_date}}. Please contact your coach for any help.'
WHERE trigger_key = 'plan_switched' AND channel = 'whatsapp';

UPDATE public.wellness_notification_templates SET message_template =
  'Hi {{name}}, {{issued_servings}} serving(s) have been packed and issued to you at All In One Wellness for {{issue_reason}}. You now have {{remaining}} servings left in your plan. Please collect them at the club.'
WHERE trigger_key = 'servings_issued' AND channel = 'whatsapp';

UPDATE public.wellness_notification_templates SET message_template =
  'Hi {{name}}, thank you for your payment at All In One Wellness. We have received an amount of {{price}} rupees through {{payment_mode}} on {{date}} towards your {{plan_name}} membership plan. Please keep this message as your confirmation.'
WHERE trigger_key = 'payment_received' AND channel = 'whatsapp';