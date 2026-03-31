# BTC Map Web App

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## Getting started

1. `git clone`\
   to clone the repo and `cd` into the directory
2. Enable Corepack (if needed)\
   If `pnpm` command is not found, run: `corepack enable`
3. `pnpm install`\
   to install the packages
4. `pnpm dev`\
   will open the app on: http://localhost:5000

### Check your changes before commit/pushing

- `pnpm run format`
- `pnpm run lint`
- `pnpm run typecheck`

### Build project

1. Create `.env`  
   Copy `.env.example` and save as `.env`
1. `pnpm build`

_NOTE:_ BTC Map uses Node 22 LTS. If you have [mise](https://mise.jdx.dev/), run `mise install` in the repo root to switch to the correct version. This project uses Corepack (bundled with Node 22) to manage pnpm automatically.

#### Icons

- [Iconify](https://iconify.design/docs/icon-components/svelte/#iconify-for-svelte): for general material/fontawesome icons via `Icon.svelte`
- Custom icons (socials, apps, mobile-nav): imported as raw SVGs in `src/lib/icons/` via wrapper components (`IconSocials.svelte`, `IconApps.svelte`, `IconMobileNav.svelte`)

### E2E tests

#### Install

```sh
  pnpm playwright install
```

#### Run tests

```sh
  pnpm playwright test
    Runs the end-to-end tests.

  pnpm playwright test --ui
    Starts the interactive UI mode.

  pnpm playwright test --project=chromium
    Runs the tests only on Desktop Chrome.

  pnpm playwright test example
    Runs the tests in a specific file.

  pnpm playwright test --debug
    Runs the tests in debug mode.
```

## PWA

This website is a progressive web app, meaning you can install it on your mobile device and use it like a native application. Just look for the **Add to home screen** or **Install** option in your browser while visiting [btcmap.org](https://btcmap.org).

## Embedding

For information on how to embed the BTC Map web map onto your own website or application please reference our [Wiki](https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Embedding).

---

## Attributions

Thanks to:

### Base map tiles

- [OpenFreeMap](https://openfreemap.org/)
- [OpenStreetMap](https://www.openstreetmap.org)

### Icons

Tagger profile badges by [AndrejCibik](https://twitter.com/AndrejCibik)

<a href="https://www.flaticon.com/free-icons/satoshi-nakamoto" title="satoshi nakamoto icons">Satoshi nakamoto icons created by Vitaly Gorbachev - Flaticon</a>

---

![Untitled](https://user-images.githubusercontent.com/85003930/194117128-2f96bafd-2379-407a-a584-6c03396a42cc.png)
