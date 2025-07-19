# BTC Map website

[![Netlify Status](https://api.netlify.com/api/v1/badges/8a9b0504-641c-4975-9e2b-daefe43f93e8/deploy-status)](https://app.netlify.com/sites/btcmap/deploys)

## Getting started

1. `git clone`\
   to clone the repo and `cd` into the directory
2. `yarn`\
   to install the packages
3. `yarn dev`\
   will open the app on: http://localhost:5173

### Check your changes before commit/pushing

- `yarn run format`
- `yarn run lint`
- `yarn run typecheck`

### Build project

1. Create `.env`  
   Copy `.env.example` and save as `.env`
1. `yarn build`

_NOTE:_ BTC Map uses the latest LTS version of [node](https://nodejs.org/). If you have [NVM](https://github.com/nvm-sh/nvm), you can simply run `nvm use` in the root directory of the repo to switch to the supported node version.

#### Icons

- [Iconify](https://iconify.design/docs/icon-components/svelte/#iconify-for-svelte): for general material icons
- [vite-plugin-icons-spritesheet](https://github.com/forge-42/vite-plugin-icons-spritesheet): for individual icons (i.e. apps) spritesheets are automatically generated  
  During development the spritsheets might not update. Use a private-tab to check the latest version.

### E2E tests

#### Install

```sh
  yarn playwright install
```

#### Run tests

```sh
  yarn playwright test
    Runs the end-to-end tests.

  yarn playwright test --ui
    Starts the interactive UI mode.

  yarn playwright test --project=chromium
    Runs the tests only on Desktop Chrome.

  yarn playwright test example
    Runs the tests in a specific file.

  yarn playwright test --debug
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
