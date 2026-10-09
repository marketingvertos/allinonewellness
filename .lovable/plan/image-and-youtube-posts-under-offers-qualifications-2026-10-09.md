# Image and YouTube posts under Offers & Qualifications

## What members will get
Published media posts will appear on the **member app home screen**, directly with the existing Offers & Qualifications content.

Each post can be published **with or without a caption** and can target:
- All members
- Physical members
- Virtual members

## Team controls
Add a separate **Media posts** section under **Offers & Qualifications**, without changing the existing offers.

Provide two clear actions:
1. **Upload image post** — choose a JPG, PNG, or WebP image, preview it, optionally add a caption, select the audience, then publish.
2. **Add YouTube video** — paste a YouTube or YouTube Shorts URL, preview the video, optionally add a caption, select the audience, then publish.

The post list will show image/video preview, caption, audience, publish status, and publish date. Editors can publish, unpublish, edit the caption/audience, or delete a post. A confirmation will protect deletion.

## Publishing behaviour
- New posts remain unpublished until **Publish** is pressed.
- Published posts appear immediately in the member app.
- Unpublished posts remain visible only to the team.
- Members see only published posts matching their Physical/Virtual mode, newest first.
- Image and video posts work with or without captions.
- YouTube links are validated and displayed through a safe embedded player; invalid or unsupported links are rejected clearly.

## Technical details
- Add a dedicated `wellness_media_posts` table with media type, stored image path or YouTube video ID, optional caption, audience, publish state/timestamps, and creator/updater IDs.
- Apply authenticated grants and row security: members can read only published matching-audience posts; existing offer editors can manage posts.
- Create a dedicated image storage bucket with image-only uploads, a practical size limit, and staff-only upload/update/delete rules.
- Add focused hooks and components for post management and member rendering; keep this separate from promotion progress calculations.
- Render responsive images and privacy-conscious YouTube embeds while preserving the existing offer colour system.
- Add validation tests for supported YouTube URL forms and invalid links, then verify publish/unpublish, captionless posts, audience filtering, image display, and video playback on desktop and mobile.
