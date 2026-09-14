# Only two goals: Weight loss and Weight gain

Everywhere a goal is chosen or shown, the choice narrows to **Weight loss** and **Weight gain**. No other goal wording stays anywhere in the system.

## Where it changes

- **Public registration form** (`/join`) — goal dropdown shows the two options, default Weight loss.
- **Add member** dialog — same two options.
- **Edit profile** dialog — same two options.
- **Registration backend** — rejects anything other than the two values, so an old link or a bot cannot slip a removed goal in.
- **Member profile, member app, lists, exports, TV boards** — already read the goal straight from the record, so they will only ever show the two labels once the data is clean.

## Existing data

Every one of the 39 current members is already on Weight loss, so nothing visibly changes for them. A safety clean-up still runs so no record can be left on a retired goal: anything that was Fat loss, Weight management, General wellness, Healthy lifestyle or Body transformation becomes Weight loss.

## Technical notes

- Introduce one shared list in `src/lib/goals.ts`: `MEMBER_GOALS = [{value:"weight_loss",label:"Weight loss"},{value:"weight_gain",label:"Weight gain"}]` plus a `goalLabel()` helper; import it in `PublicRegister.tsx`, `CreateMemberDialog.tsx` and `EditMemberDialog.tsx`, deleting their local `GOALS` arrays.
- `supabase/functions/public-register/index.ts`: narrow the goal enum to `["weight_loss","weight_gain"]` and redeploy.
- `src/components/wellness/AchievementsPanel.tsx:85`: the milestone eligibility check currently lists four goals — reduce to the two.
- `MemberDashboard` goal badge keeps its `replace(/_/g," ")` rendering, which reads correctly for both values.
- Database: keep the `wellness_goal` enum as-is (removing enum values is a breaking change); run a data update mapping the five retired values to `weight_loss`. Existing "gain vs loss" branches (`useWellness.ts:1877`, `DisplayWeightChanges.tsx`, `PortalHome.tsx`, `AchievementsPanel.tsx:66`) already treat anything that is not `weight_gain` as loss, so they need no change.
