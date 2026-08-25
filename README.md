# BTC Map Web App

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## Getting started

1. `git clone`\
   to clone the repo and `cd` into the directory
2. Install [pnpm](https://pnpm.io/installation) ≥ 10 (if needed)\
   If `pnpm` is not found — or `pnpm --version` reports < 10 — run `mise install` (see note below) or use one of the [standalone installation methods](https://pnpm.io/installation)
3. `pnpm install`\
   to install the packages
4. `pnpm dev`\
   will open the app on: http://localhost:5000

### Check your changes before commit/pushing

- `pnpm run format:fix`
- `pnpm run lint`
- `pnpm run check`
- `pnpm run typecheck`
- `pnpm run test --run`

### Local API development

To test the frontend against a local [btcmap-api](https://github.com/teambtcmap/btcmap-api) instance:

1. Start the API: `cd btcmap-api && cargo run` (binds to `127.0.0.1:8000`)
2. Add to your `.env` — pick one:
   - `VITE_API_BASE_URL=/btcmap-api-proxy` — routes through the Vite dev proxy (avoids CORS; works for client-side calls and SSR load functions that use SvelteKit's `event.fetch`)
   - `VITE_API_BASE_URL=http://127.0.0.1:8000` — direct; works everywhere including SSR axios calls, but requires the API to send CORS headers
3. Start the frontend: `pnpm dev`

Remove or comment out the env var to switch back to the production API.

**Note:** The add-location form submits through `/api/submit-place`, which calls btcmap-api's `submit_place` RPC and needs `BTCMAP_IMPORT_TOKEN` (plus `BTCMAP_API_RPC_URL` when testing against a local API).

### Build project

1. Create `.env`  
   Copy `.env.example` and save as `.env`
1. `pnpm build`

_NOTE:_ BTC Map requires Node.js ≥ 22.13 (we use Node 22 LTS). If you have [mise](https://mise.jdx.dev/), run `mise install` in the repo root to get the correct Node and pnpm versions. Any pnpm ≥ 10 works: pnpm reads the `packageManager` pin in `package.json` and switches to that exact version automatically, so Corepack is not needed locally (pnpm [no longer recommends it](https://pnpm.io/installation)). Netlify builds are the exception: Netlify still provisions pnpm [via Corepack](https://docs.netlify.com/build/configure-builds/manage-dependencies/#pnpm) from that same `packageManager` field — so keep the field pinned to an exact version, and see the comment in `netlify.toml` for the Node-version floor this implies.

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

For information on how to embed the BTC Map web map onto your own website or application please reference our [Wiki](https://wiki.btcmap.org/Embedding).

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
