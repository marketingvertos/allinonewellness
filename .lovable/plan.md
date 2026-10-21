# WLP invitation: delivery check and resend

## What the check found
- The picture fix works. Meta now accepts the message with the poster attached.
- The broadcast to all active members is still sending: 20 sent so far, 0 rejected by Meta.
- Results so far: 16 delivered, 4 read, 6 still on the way.
- 12 people (including Pawan, 9815064617) were blocked with Meta error 131049. Meta limits how many marketing messages one person can get, and it held these back. The app did nothing wrong. Sending again right away to the same people usually gets blocked again and can hurt the number's quality rating.

## Plan
1. Let the current broadcast finish, without stopping or restarting it.
2. Show the reason for each failure in plain words in the broadcast's "Show failed" list, e.g. "Meta marketing limit, try again tomorrow" for 131049 and "Picture missing" for 132012.
3. Make **Retry failed** skip 131049 failures for 24 hours, with a note explaining why, so nobody resends too early by mistake.
4. Resend now only to people whose failure had a cause that is now fixed: the earlier missing-picture failure.
5. For the 131049 group, offer either of these:
   - a retry tomorrow (but the 21 Oct date will be over by then), or
   - a free-form text reminder to anyone who messaged the centre in the last 24 hours, since Meta allows that without a template.

## Technical details
- Map the error codes in the `whatsapp-broadcast` retry_failed action: skip 131049 when `sent_at` is less than 24 hours ago.
- Add a friendly error label helper in `WhatsAppBroadcast.tsx`.
- Do not change the shared sender. The poster mapping is already deployed.
