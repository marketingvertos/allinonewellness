# Member Tags — remaining gap

Most of the uploaded brief is already live in the app: members can be tagged as Coach, Preferred Customer (PC) or MRP Customer when created or edited, the tags show on the member list, member profile header and check-in search results, the members list has a tag filter, and tags are included in the CSV export.

One item from the brief is missing.

## What to add

**One-click tag toggle on the member profile**

In the member profile Overview panel, add a "Tags" card next to the existing Batch and Referrer cards. It shows the three tags as buttons; clicking one turns it on or off and saves immediately, with a tick shown on active tags. This means staff can tag someone straight from the profile without opening the Edit form.

## Technical note

Single change in `src/components/wellness/MemberDetailSheet.tsx`: add a tags card in the Overview tab (after the Batch section, around line 238) using the existing `MEMBER_TAGS` constant from `memberMeta.tsx` and the already-present `updateMember` mutation (`updateMember.mutate({ id: member.id, tags: next })`). No database migration is needed — the `tags` column, GIN index, types, hook filter and shared components all already exist.
