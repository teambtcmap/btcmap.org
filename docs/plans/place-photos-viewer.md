# Place photos viewer: PhotoSwipe implementation plan

Issue #1469, PR #1470. Based on the Claude Design files "Place photos viewer - GLightbox plan.md" and "Place photos - header and viewer.html". The plan keeps the design's screens and behaviour but swaps the library.

## Library: PhotoSwipe 5 instead of GLightbox

Checked against the published packages on 2026-10-01.

| Library | Last release | gzip | Verdict |
| --- | --- | --- | --- |
| **PhotoSwipe 5** (MIT) | 5.4.4, May 2024 | ~18 KB JS+CSS | Chosen. See the reasons below this table. |
| bigger-picture (MIT) | 1.1.20, Feb 2026 | ~10 KB | Runner-up. Problems: a single maintainer, no swipe-down-to-close found, and the default `svelte` export compiles its Svelte 3 source, which calls the removed `new Component()` API. It would have to be imported as `bigger-picture/vanilla`. |
| GLightbox (design plan) | 3.3.1, Jan 2025 | ~18 KB | Rejected. Problems: no code changes since Jan 2025; it always appends to `<body>` and marks every other body child `aria-hidden`, so it can't mount in our stage and would hide our caption bar from screen readers; its Tab handling only cycles its own `.gbtn` buttons. |
| lightGallery | 2.9.0 | ~24 KB with plugins | Rejected: GPLv3 or a commercial license, plus plugin sprawl. |
| Fancybox (@fancyapps/ui) | 6.1.15 | — | Rejected: paid license. |
| Swiper / viewer.js / spotlight / basicLightbox / medium-zoom | — | — | Rejected: a carousel with no modal, a toolbar viewer with no swipe, abandoned, or single-image zoom only. |

Why PhotoSwipe:

- It mounts inside our own overlay (`appendToEl`).
- It is built for programmatic data with known width and height, which the API returns.
- Pinch-zoom and swipe-down-to-close are built in.
- Its UI, keyboard handling and focus handling can each be switched off.
- It has about 25k GitHub stars.

Risk: no npm release since May 2024, although fixes land in the repo until Nov 2025. Only the wrapper module imports it, so a swap touches one file.

## Decisions

- Work continues on #1470, one commit per step.
- "Report photo" waits for a report endpoint. Since btcmap-api@7a6450d, owners can delete their own photos and admin/root can delete any (a first moderation tool).
- The credit shows "Photo by <author.name>" (btcmap-api@7a6450d returns `author { id, name }`), falling back to "Community photo". Plain text: btcmap accounts have no public profile page to link to.
- No RTL work: none of the 9 locales is RTL.
- The deep link is read inside `PlacePhotos`. `merchant/[id]/+page.svelte` is a #1208 hotspot: it only gets one-line prop passes (`placeName`), no logic.

## Steps

### 1. Section header and empty state (`PlacePhotos.svelte`, no new dependency)

- Header: "Photos N" with the same label style as "Accepts" (reusing the `placePhotos.title` key), plus an "Add photo" text button with the `add_a_photo` icon. The button fires `place_photo_add_click`.
- The trailing add tile goes away. Upload spinner tiles move to the start of the strip.
- Empty state (`photos.length === 0 && canAdd`): a dashed 64px row reading "Be the first to add a photo", with "Storefront, inside, bitcoin sticker or QR" as the subline. No header. Deleted places render nothing, and so does a failed load (the invitation would be a false claim).
- Merchant page on mobile: the strip runs edge to edge (`-mx-4` on the wrapper, `px-4 scroll-px-4` on the strip), so the overlays line up with its edges.
- Drawer: square 88px tiles.
- Scroll chevrons on pointer devices (Tailwind `pointer-fine`), in every layout (merchant page and drawers): back and forward, each with an edge fade into the background behind the strip (teal on the page, white in the drawer). Each shows only while that direction can scroll (`stripScrollState`), scrolls by `clientWidth * 0.8` and fires `place_photo_strip_scroll` with its `direction`.
- Tile caption on hover or keyboard focus: the uploader's name (or "Community photo"), plus the relative date on the merchant page. `aria-hidden`; the alt names the link.
- Skeleton: a single row at tile height, from the shared `Skeleton` component.
- New i18n keys in all 9 locales: `placePhotos.emptyTitle`, `emptyHint`, `morePhotos`, `previousPhotos`.

### 2. PhotoSwipe wrapper (`src/lib/placePhotoLightbox.ts`)

- `pnpm add photoswipe` (5.4.4).
- The wrapper is the only module that imports PhotoSwipe. It loads the JS and CSS on first open (`await import(...)`).
- Data source: `{ src, srcset (800/1200/1600 via placePhotoUrl), width, height, alt }`, built from `PlaceImage`.
- Options:
  - `appendToEl`: our stage
  - `loop: false`
  - `bgOpacity: 1`
  - `showHideAnimationType`: `'none'` when reduced motion is on, otherwise `'fade'`
- Switched off, because our Svelte chrome owns them:
  - the built-in UI: `arrowPrev`, `arrowNext`, `close`, `counter`, `zoom`
  - the keyboard: `escKey`, `arrowKeys`
  - focus handling: `trapFocus`, `returnFocus`. PhotoSwipe's trap would pull focus out of our header.
- Events: `change` → `onChange(currIndex)`, `close`/`destroy` → `onClose()`. Exposes `goTo`, `close` and `destroy`.
- CSS: inside our stage `.pswp` is `position: absolute` instead of fixed, scoped with `mainClass`.
- Unit tests for the data-source and srcset builder.

### 3. Viewer rewrite (`PlacePhotoViewer.svelte`)

- Props: today's props plus `placeName` and `source`.
- Overlay: portaled to `<body>`, full-screen, `--dark` background.
- Top bar: place name, then the credit ("Photo by …" or "Community photo"), the relative date and "3 / 6", then the ⋯ and ✕ buttons.
  - The date uses svelte-time's `<Time relative live>` with the app's dayjs locale, loaded on demand by `$lib/dayjsLocale` (`createTimeLocale`); English shows until it arrives. `dayjs` is a direct dependency for those locale imports. `svelte-time/intl` was dropped: it broke the production build (rolldown parse error) and ships no types. The rest of the app follows in #1482.
  - The counter uses `tabular-nums`.
- Desktop: 44px arrows in 72px side zones, disabled at the ends and hidden on touch devices.
- Footer:
  - Desktop: a filmstrip built from the cached strip thumbnails.
  - Mobile: dots for 8 photos or fewer, otherwise only the counter.
- Keys, in the capture phase:
  - ← / → go to the previous or next photo.
  - Esc closes the viewer.
  - Every key stops propagating while the viewer is open. The mobile drawer also reacts to ↑ ↓ Enter.
- Focus and scroll: a shared `$lib/focusTrap` helper keeps Tab inside the viewer; on close, focus goes to the strip tile of the photo that was showing (works for deep-link opens and on macOS Safari, where clicks don't focus buttons); our scroll lock stays.
- Close and destroy wait for PhotoSwipe's opening animation to end: PhotoSwipe ignores both while it runs.
- i18n: drop `placePhotos.addedOn`, add `placePhotos.communityPhoto`.

### 4. Deep link and copy link

- On open and on every change, `replaceState` to `?photo=<id>`, keeping the other params. Close removes it.
- `PlacePhotos` opens the viewer at the matching index when the page loads or when the drawer resolves `?merchant=`. Unknown ids are ignored. On mobile, the map sheet opens expanded when the URL has `?photo=`, since the strip only mounts in the expanded sheet.
- The ⋯ menu (`svelte-outclick`) has "Copy link to photo": it copies `origin/merchant/{id}?photo={imageId}` and shows a toast. Opening the menu fires `place_photo_menu_open`.
- New i18n keys: `copyLink`, `linkCopied`.

### 5. Analytics

| Event | When | Props |
| --- | --- | --- |
| `place_photo_open` | viewer opens (existing) | `source`, `index`, `via: tile \| deeplink` |
| `place_photo_view` | slide change (new), once per photo per open | `source`, `index` |
| `place_photo_link_copy` | copy link (new) | `source` |
| `place_photo_add_click` | header button or empty row (existing) | `source`, `entry: header \| empty`, `signedIn` |
| `place_photo_strip_scroll` | strip chevron (new) | `source`, `direction: back \| forward` |
| `place_photo_menu_open` | viewer ⋯ menu (new) | `source` |
| `place_photo_add_success` | upload stored | `source`, `count` |
| `place_photo_delete_click` / `_cancel` / `_success` | ⋯ menu or My photos delete | `source` |
| `place_photo_upload_undo_click` / `_success` | Undo on the upload toast | `source`, `count` |
| `place_photo_prompt_create_account_click` / `_login_click` | signed-out sign-in modal | none |
| `my_photos_click` | user menu link | none |
| `my_photos_tile_click` | My photos card | `link: photo \| place` |

### 6. QA

The Playwright spec below was not written; the behaviours were checked by hand and with before/after screenshots.

- Playwright on `/merchant/20423` and `/map?merchant=20423`. CI runs it, because local e2e is broken on this machine. The spec checks:
  - the counter reads "1 / N"
  - next and previous stop at the ends
  - Esc closes the viewer and leaves the drawer open
  - `?photo=<id>` opens the matching photo, and closing removes it
  - mobile swipe changes photo, and swipe-down closes
  - focus returns to the tile
- Before/after screenshots at 390px and desktop, light and dark.
- Update the PR body.
- Test on a real iPhone (Safari): pinch and pan inside a non-viewport container.

### 7. Shipped on top (#1483–#1485, merged into #1470)

- Credit: "Photo by <name>" from the API's `author`, falling back to "Community photo".
- Delete: "Delete photo" in the viewer's ⋯ menu for the uploader and for admin/root (`DELETE /v4/places/{id}/images/{image_id}`; id and roles from `GET /v4/users/me` via `$lib/currentUser`), with a confirm step; a 403 gets its own message. Plus an Undo action on the upload toast.
- "My photos" page at `/user/photos` from `GET /v4/users/me/place-images` (`type=user` only), linked from the user menu, with delete. The ask/cancel/confirm flow is shared with the viewer (`$lib/placePhotoDelete`, `PhotoDeleteConfirm`).

### 8. Later

- Report photo: `POST /v4/place-reports` with `type: "photo_report"` and the image id, after the moderation decision. Events `place_photo_report_click` / `_success`. Signed-out users get `PhotoAuthPrompt`.
