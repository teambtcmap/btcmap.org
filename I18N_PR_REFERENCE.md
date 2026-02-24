# i18n Translation PRs – Reference

Each PR follows **1 view per PR** and can include multiple components for that view.  
When a PR is completed in chat, use the **Open PR** link to create it on GitHub.

---

## CodeRabbit Review Checklist (apply proactively)

Use these patterns when implementing PRs to avoid repeat review comments.

### 1. Locale reactivity

**Issue:** Strings computed once (e.g. in `renderTable()` or similar) don't update when the user switches language.

**When it applies:** Components that build translated data in a one-time setup (tables, lists, config objects).

**Fix:** If translated values are computed inside a function that runs once, subscribe to the `locale` store and reset/re-run that logic when locale changes. Example (from IssuesTable):

```js
import { _, locale } from "$lib/i18n";

let localeInitialized = false;
$: if ($locale) {
  if (localeInitialized) {
    tableRendered = false;  // or whatever flag gates re-computation
  } else {
    localeInitialized = true;
  }
}
```

**PRs to watch:** 4 (Merchant), 5 (Map), 13 (Leaderboard).

---

### 2. Consistent locale keys

**Issue:** Orphaned keys in one locale file that don't exist in en/pt-BR or aren't used by components.

**Fix:** Add new keys to all three locale files (en, pt-BR, bg). Remove unused keys. Keep structure identical across locales.

---

### 3. Accessibility for segmented controls

**Issue:** Button groups that act as filters/tabs don't expose which option is active to screen readers.

**Fix:** For segmented controls / filter buttons:
- Wrapper: `role="tablist"`
- Each button: `role="tab"`, `aria-selected={active}`, `aria-disabled={disabled}`

```html
<div role="tablist">
  {#each items as item, i (i)}
    <button
      role="tab"
      aria-selected={showType === i}
      aria-disabled={disabledCondition}
      ...
    >
      {item}
    </button>
  {/each}
</div>
```

**PRs to watch:** 4 (Boost duration, payment toggles), 5 (category filters), 13 (period selector, pagination).

---

### 4. Pluralization (avoid English-only suffix)

**Issue:** Using `{plural}` with `s` or `""` (e.g. `month{plural}`) is English-only. It produces invalid forms in other locales: `месецs` (bg), `mêss` (pt-BR).

**Fix:** Use separate keys for singular vs plural instead of suffix interpolation:
- `boostFor1Month` / `boostForNMonths` with `{time}` in the plural key
- `duration1Month` / `durationNMonths` for button labels
- `invoiceDescription1` / `invoiceDescriptionN` for HTML descriptions

Each locale supplies grammatically correct forms (e.g. pt-BR: `mês` vs `meses`, bg: `месец` vs `месеца`).

**PRs to watch:** 4 (Boost), any PR with numeric + unit strings (e.g. "X months", "X days").

---

### 5. Translate all user-facing strings

**Issue:** User-visible strings left hardcoded: toast messages, error text, share URLs, button labels.

**Fix:** For every string in UI:
- Toast messages: `warningToast($_("key"))`, `errToast($_("key"))`
- Error messages: add keys like `boost.finalizeError`, `boost.invalidDuration`
- Share URLs: extract pre-fill text to i18n key, use `encodeURIComponent($_("key", { values }))`
- Button labels: duration labels ("1 month", "3 months") must use i18n

**PRs to watch:** All PRs.

---

### 6. Grammar and typography

**Issue:** Typos in locale strings (e.g. "it's" vs "its" for possessive).

**Fix:** Use possessive "its" (not "it's").

---

### 7. Consistent terminology within a locale

**Issue:** Same concept uses different words in the same locale (e.g. bg: "сатоши" vs "сата" for sats).

**Fix:** Use the same term across related keys (e.g. `commentAdd.currentFee` and `comments.currentFee`).

---

## PR 1: Tagging Issues View

**Branch:** `feat/i18n-tagging-issues`

**Title:** `feat(i18n): translate tagging issues view`

**Comment (PR description):**
```
Translates the Tagging Issues view for en, pt-BR, and bg.

- tagging-issues/+page.svelte
- IssuesTable.svelte (search, headers, pagination, issue types, empty states)
- TaggingIssues.svelte ("No tagging issues!")

Adds `issuesTable` section to locale files. These components are also used on area and merchant views and will pick up translations automatically.
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-tagging-issues

---

## PR 2: Area View

**Branch:** `feat/i18n-area-view`

**Title:** `feat(i18n): translate area view (country/community)`

**Comment (PR description):**
```
Translates the Area view for en, pt-BR, and bg.

- AreaPage.svelte
- AreaTickets.svelte (ticket types, tooltip, viewOnGitea)
- AreaStats.svelte
- MerchantCard.svelte (notRecentlyVerified, verify)
- AreaActivity.svelte
- VerifyCommunityForm.svelte

Depends on: FormSuccess (PR 3), IssuesTable/TaggingIssues (PR 1).
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-area-view

---

## PR 3: Add Location View (incl. FormSuccess)

**Branch:** `feat/i18n-add-location`

**Title:** `feat(i18n): translate add location view and FormSuccess`

**Comment (PR description):**
```
Translates the Add Location view and FormSuccess component for en, pt-BR, and bg.

- add-location/+page.svelte
- FormSuccess.svelte (used by add-location, verify-location, communities/add, tagger-onboarding, VerifyCommunityForm)

Adds `formSuccess` section to locale files. FormSuccess is shared across multiple form flows.
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-add-location

---

## PR 4: Merchant View

**Branch:** `feat/i18n-merchant-view`

**Title:** `feat(i18n): translate merchant view (details, boost, tip)`

**Comment (PR description):**
```
Translates the Merchant view for en, pt-BR, and bg.

- merchant/[id]/+page.svelte
- MerchantDetailsContent.svelte
- BoostContent.svelte
- InvoicePaymentStage.svelte
- CommentAdd.svelte (tip flow)

Adds/extends `boost` section. BoostContent and InvoicePaymentStage are also used in the map merchant drawer.
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-merchant-view

---

## PR 5: Map View

**Branch:** `feat/i18n-map-view`

**Title:** `feat(i18n): translate map view`

**Comment (PR description):**
```
Translates the Map view for en, pt-BR, and bg.

- map/+page.svelte
- MapSearchBar.svelte
- MerchantListPanel.svelte
- MerchantListItem.svelte
- MapLoadingEmbed.svelte
- MerchantDrawerMobile.svelte
- MerchantDrawerDesktop.svelte

Uses BoostContent/InvoicePaymentStage from PR 4. Adds any map-specific strings not yet covered.
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-map-view

---

## PR 6: Media View

**Branch:** `feat/i18n-media`

**Title:** `feat(i18n): translate media view`

**Comment (PR description):**
```
Translates the Media view for en, pt-BR, and bg.

- media/+page.svelte (title, headings, asset names, Download All)
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-media

---

## PR 7: About Us View

**Branch:** `feat/i18n-about-us`

**Title:** `feat(i18n): translate about us view`

**Comment (PR description):**
```
Translates the About Us view for en, pt-BR, and bg.

- about-us/+page.svelte
- AboutCommunity.svelte
- AboutContributor.svelte
- AboutCore.svelte
- AboutIntegration.svelte
- AboutMerchant.svelte
- AboutPlus.svelte
- AboutTagger.svelte
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-about-us

---

## PR 8: Privacy Policy View

**Branch:** `feat/i18n-privacy-policy`

**Title:** `feat(i18n): translate privacy policy view`

**Comment (PR description):**
```
Translates the Privacy Policy view for en, pt-BR, and bg.

- privacy-policy/+page.svelte (full policy text and headings)
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-privacy-policy

---

## PR 9: Support Us View

**Branch:** `feat/i18n-support-us`

**Title:** `feat(i18n): translate support us view`

**Comment (PR description):**
```
Translates the Support Us view for en, pt-BR, and bg.

- support-us/+page.svelte
- DonationOption.svelte
- SupportSection.svelte
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-support-us

---

## PR 10: Badges View

**Branch:** `feat/i18n-badges`

**Title:** `feat(i18n): translate badges view`

**Comment (PR description):**
```
Translates the Badges view for en, pt-BR, and bg.

- badges/+page.svelte (Achievements, Contributions headings)
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-badges

---

## PR 11: Apps View

**Branch:** `feat/i18n-apps`

**Title:** `feat(i18n): translate apps view`

**Comment (PR description):**
```
Translates the Apps view for en, pt-BR, and bg.

- apps/+page.svelte (Official, Community headings)
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-apps

---

## PR 12: Communities Map View

**Branch:** `feat/i18n-communities-map`

**Title:** `feat(i18n): translate communities map view`

**Comment (PR description):**
```
Translates the Communities Map view for en, pt-BR, and bg.

- communities/map/+page.svelte ("View Community" button and related strings)
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-communities-map

---

## PR 13: Leaderboard View

**Branch:** `feat/i18n-leaderboard`

**Title:** `feat(i18n): translate leaderboard view`

**Comment (PR description):**
```
Translates the Leaderboard view for en, pt-BR, and bg.

- leaderboard/+page.svelte
- communities/leaderboard/+page.svelte
- countries/leaderboard/+page.svelte
- LeaderboardSearch.svelte
- LeaderboardPagination.svelte
- AreaLeaderboardItemName.svelte
- TaggerLeaderboardMobileCard.svelte
- TaggerLeaderboardDesktopTable.svelte
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-leaderboard

---

## PR 14: Layout (Header & Footer)

**Branch:** `feat/i18n-layout`

**Title:** `feat(i18n): translate layout (header, footer)`

**Comment (PR description):**
```
Translates the shared layout for en, pt-BR, and bg.

- Header.svelte
- Footer.svelte

Covers nav links, footer links, map controls, tip button.
```

**Open PR:** https://github.com/teambtcmap/btcmap.org/compare/main...feat/i18n-layout

---

## Suggested Order

| Order | PR | Depends on |
|-------|-----|------------|
| 1 | PR 1: Tagging Issues | — |
| 2 | PR 3: Add Location | — |
| 3 | PR 2: Area | PR 1, PR 3 |
| 4 | PR 4: Merchant | — |
| 5 | PR 5: Map | PR 4 |
| 6–14 | PR 6–14 | — (can run in parallel) |

---

## Note on Open PR Links

If you use a fork (e.g. `YOUR_USERNAME/btcmap.org`), after pushing your branch:

1. Go to https://github.com/teambtcmap/btcmap.org
2. GitHub will show a banner to create a PR from your branch, or
3. Use: `https://github.com/teambtcmap/btcmap.org/compare/main...YOUR_USERNAME:btcmap.org:feat/i18n-XXX`

Replace `YOUR_USERNAME` with your GitHub username and `feat/i18n-XXX` with the branch name from the table above.
