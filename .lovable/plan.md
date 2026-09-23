# Check-in messages failing: "API access blocked"

## What is actually happening

Every WhatsApp send since 07:36 IST today is rejected by Meta with the same reply:

```text
"message": "API access blocked.", "code": 200, "type": "OAuthException"
```

This is not a problem with the check-in wording, the template, or the app. The same
template sent successfully yesterday evening (19:36 IST, delivered and read). Since
then Meta has blocked API access for the WhatsApp account or the app behind the
permanent token, so every send — manual and automatic — comes back rejected within
a second. Nine attempts today, all blocked, for four different members.

Meta blocks API access for reasons like: business verification pending or expired,
a policy/quality strike on the number, the app being restricted, or the system user
losing access to the WhatsApp account.

## What needs to be done

1. **Check the account in Meta** (you, in WhatsApp Manager / Business Manager):
   look for a red banner on the number, business verification status, and any
   policy notice. That is where the block must be lifted — nothing in the app can
   bypass it.
2. **Add a status check in the app** so you can see the cause without guessing: a
   "Check WhatsApp account status" button in WhatsApp settings that asks Meta for
   the number's quality rating, messaging limit, review status and account
   restrictions, and shows the answer in plain language.
3. **Show the real reason on the message** instead of the bare "API access blocked":
   blocked-account errors get a clear line telling you the account is restricted at
   Meta and sending is paused, so nobody keeps hitting Retry.
4. **Hold instead of burn attempts**: when Meta returns this account-level block, the
   queued message is left queued (and not counted against its three tries) rather
   than marked failed, so the moment the block is lifted the backlog goes out on the
   next run without re-queuing anything by hand.
5. **Re-send today's blocked ones** once access is restored: the handful of messages
   already marked failed today get re-queued so those members still receive their
   check-in confirmation.

## Technical notes

- Diagnostic: extend `supabase/functions/whatsapp-test-connection/index.ts` (staff-only,
  already exists) with a `GET /v25.0/{phone_number_id}?fields=display_phone_number,
  quality_rating,messaging_limit_tier,name_status,code_verification_status,
  platform_type,throughput` plus `GET /v25.0/{waba_id}?fields=name,account_review_status,
  business_verification_status,message_template_namespace` and return both blocks.
  Surface it from `src/components/settings/WhatsAppSettings.tsx` as a status card.
- Error mapping: in `supabase/functions/_shared/whatsapp.ts`, treat
  `error.code === 200` / `type === "OAuthException"` with message "API access blocked"
  as a distinct `account_blocked` outcome; store a readable `error_message`
  ("WhatsApp account access is blocked at Meta — resolve it in WhatsApp Manager")
  on `whatsapp_messages` and `wellness_notification_log`.
- Runner: in `supabase/functions/whatsapp-notification-runner/index.ts`, on
  `account_blocked` leave `status = 'queued'` and do not increment `attempts`;
  stop the rest of the batch early to avoid nine pointless calls per run.
- Data: re-queue today's blocked rows
  (`update wellness_notification_log set status='queued', attempts=0
  where error_message like 'API access blocked%'`) as a one-off query, after the
  block is cleared.
- No schema change, no UI redesign; attendance and check-in logic untouched.
