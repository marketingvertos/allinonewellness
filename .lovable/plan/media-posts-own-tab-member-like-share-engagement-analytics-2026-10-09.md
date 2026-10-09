# Media posts: own tab, member Like/Share, engagement analytics

## Page layout (staff)
- The Offers & Qualifications page gets two tabs at the top: **Offers** and **Media updates**.
- The page header has **New offer**, **Upload image** and **Add YouTube video** buttons, so nobody has to scroll down to find them.
- The Media updates tab opens with summary tiles for the last 30 days:
  - Total views
  - Unique members who viewed
  - Likes
  - WhatsApp shares
- Each post card shows its own numbers: views, unique viewers, likes and shares.
- Tapping a post's numbers opens a list of the members who liked or shared it, with date and time.

## Member app (Updates feed)
Each post gets two buttons:
- **Like.** Tap to like and tap again to unlike. The total like count shows next to the heart.
- **Share on WhatsApp.**
  - **Image posts on a phone:** the share sheet opens with the picture and caption together. The member picks WhatsApp and the photo and text go straight in.
  - **YouTube posts, or phones that can't share pictures:** WhatsApp opens with the caption and the video link already typed in.
- **Views:** a post counts as viewed once it has been on screen for about a second. Each visit counts toward total views. Each member counts only once toward unique views.

## Rules
- Members can only like or share as themselves, and can't see who else liked a post. Staff can see the full list.
- Likes, views and shares are recorded only for published posts.

## Technical details
- Migration with three new tables, each with GRANTs and RLS:
  - `wellness_media_post_likes`: post_id, member_id, created_at, unique (post_id, member_id).
  - `wellness_media_post_views`: post_id, member_id, viewed_at.
  - `wellness_media_post_shares`: post_id, member_id, channel default 'whatsapp', created_at.
  - Members can insert and delete only their own rows, checked with `owns_wellness_member`. Staff can read everything through `is_wellness_staff`.
  - Security-definer RPC `media_post_stats(p_from, p_to)` returns per-post views, unique viewers, likes and shares for staff. `member_media_like_counts()` returns total likes per published post, plus whether the signed-in member liked it.
- `useMediaPosts.ts`: add `useMediaPostStats`, `useToggleMediaLike`, `useRecordMediaView` and `useRecordMediaShare`.
- `MediaPostFeed.tsx`:
  - Like and Share buttons.
  - Views are recorded with the existing `useIntersectionObserver`, once per post per session.
  - Sharing uses `navigator.share({ files, text })`: fetch the signed image into a File and check `canShare`. It falls back to `https://wa.me/?text=`.
- `WellnessPromotions.tsx`: add the Tabs and header buttons. `MediaPostsManager` takes props to open its dialogs from the header, and shows the stats tiles, per-post counts and an engagement sheet.
- Verify the staff tabs and member buttons in the preview. Typecheck.
