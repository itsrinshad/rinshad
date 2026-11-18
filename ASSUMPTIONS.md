# SYMBIOTES Phase 4 — assumptions (read before deploying)

## Install
1. Supabase → SQL Editor → run `supabase/SYMBIOTES_PHASE4.sql` (after the two earlier scripts; safe to re-run).
2. If the script says the storage step was skipped, create a **public** bucket named `pet-uploads`.
3. Deploy the `website/` folder as before (`npm install && npm run build`). All art lives in `website/public/assets`.

## What the PDF did and did not contain (so some art is reused)
- The PDF has **no undergarment base for LEO**. LEO's default-outfit sprite is used as his base; skins are drawn over it. An admin can upload a proper one later.
- Pants, glasses, shoes sheets exist **only for LEO** (glasses also for GOJO). ZEN, GOJO, LEVI, SAKURA reuse LEO's pants/shoes (and LEO's glasses/headwear/foods where the PDF has no sheet) with LEO's names. No names or art were invented.
- Foods: LEO, LEVI and SAKURA use their own PDF foods; ZEN and GOJO reuse LEO's. The PDF's "Kalea" is shown with the nickname SAKURA.
- Background PDF art is 1376x768 (16:9), used as-is. "Floor cushion" in BG01 had no coordinates in the PDF; I placed it at 50%, 80%. All other walk zones and sit anchors are exactly as in the PDF.
- Sprite sheets were sliced and background-cleaned automatically, then aligned to each body on a 512x512 canvas (Footwear 1, Pants 2, Body 3, Tops 4, Glasses 5, Headwear 6). Alignment is approximate; eyeball a few combinations.
- Emotion sheets are baked with the default outfit. When a player wears a top, pants or shoes, the layered base body is used and the emotion shows as animation plus an emote badge. Layers use a waist-cut copy of the body so pants and shoes are visible; unworn top/pants/shoes fall back to the free basics (item 1 of each).

## Rules I had to interpret
- **Deadline**: the code had no "Sunday 6:00 AM" rule; it had a daily 10–11 PM IST glory window and a Sunday 11:00 PM IST weekly close. Now: Mon–Sat unchanged; Sunday submissions stay open until **11:59 PM IST**; the weekly close cron moved to 23:59 IST. Countdown is on Home, Glory Tracker and Rewards.
- Rewards use weekly glory (this week, or last week until it is claimed). One claim per week; 5,000 allows a character **or** a skin, 3,000 a skin for the current character.
- Free items: LEO, the first top/pants/shoes of each character, bg01, the 4 free foods + daily cake. Foods 6–9 and everything else come from rewards or admin gifts. Approved uploads become free for everyone.
- "Starter / 300 glory" for BG02 = 300 lifetime glory. BG05 unlocks at 4,500 lifetime glory **or** the Glory Champion badge. Old backgrounds are hidden and saved rooms are mapped to bg01–bg05.
- Old girl pet (LEA) becomes SAKURA (and she is unlocked for them); everyone else is LEO. Nothing is deleted. Old SVG pets are no longer drawn.
- Visitor privacy switches default to **on** (one-time migration), so visitors can see rooms; members can turn it off in LEO → Settings.
- A visit = the site open while logged in (pinged at most every 4 minutes); "today" follows IST.
- Upload checks (PNG signature, size, 512x512 / 1920x1080, transparent corners/edges) run in the browser and again when the admin opens the item; the server enforces size, dimensions, type, name and a 20-pending limit. Uploaded files are in a public bucket under unguessable names. Uploaded characters are a single sprite (no 6 emotions).
- Admin-set walk zone and sit anchors are required before a background can be approved.
- Companion: hidden on LEO/profile/admin/login pages (they already show the character), off on devices with ≤2 GB RAM/≤2 cores, data-saver, Lite mode or reduced motion.
- Not run against a live Supabase: the SQL is syntax-checked and the front end builds and was tested in a browser for the public page, rooms, walking and sitting. Please test the full flow once on a staging project.
