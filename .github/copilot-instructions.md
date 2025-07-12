# GitHub Copilot Instructions for BTC Map

## Project Overview

BTC Map is a progressive web app for finding Bitcoin-accepting merchants worldwide. The core architecture revolves around:

- **Interactive map** using Leaflet with clustered markers for merchants
- **Real-time data sync** from btcmap.org API with local caching via LocalForage
- **Community-driven content** with areas, users, events, and merchant verification
- **Mobile-first design** with PWA capabilities for offline usage

## Framework Stack

### Svelte/SvelteKit v4

- We use Svelte in version v4 - for reasons we do not upgrade to v5 yet
- Some code is not really written according to Svelte - if you notice a chance to be more idiomatic, please suggest it
- We use SvelteKit as our full-stack framework for routing, SSR, and build tooling
- Follow SvelteKit conventions for file-based routing in `src/routes/`
- Use SvelteKit's load functions for data fetching when appropriate
- Prefer SvelteKit's built-in features over external libraries when possible
- Organize API routes under `src/routes/api/` (e.g., `src/routes/api/merchants/+server.ts`) - though this project primarily uses client-side data syncing
- Use load functions for initial page data, API routes for client-side requests
- Use form actions for mutations and form submissions - see `src/routes/verify-location/` for examples
- Server-side data loading with `+page.server.ts` files for SEO-critical pages
- No traditional API routes - data syncing happens client-side from external API

### TailwindCSS v3

- We use TailwindCSS in version v3 - for reasons we do not upgrade to v4 yet
- Use TailwindCSS classes for styling components
- Prefer utility-first classes over custom CSS when possible
- Use TailwindCSS for responsive design and theming
- **Custom color palette**: Bitcoin orange/teal theme with custom classes like `text-bitcoin`, `bg-teal`, `text-mapButton`
- **Dark mode** support via `dark:` classes and theme detection
- **Responsive**: Mobile-first with `md:` breakpoints for desktop enhancements

### TypeScript

- We use TypeScript for type safety and better developer experience
- We would like to avoid `any` types - but i.e. some API results are not typed yet. You can suggest to create a type together with the user to establish a type-safe codebase
- Avoid `any` types - create proper interfaces in `src/lib/types.ts`
- OSM tag data often untyped - suggest creating `OSMTags` extensions
- Use provided types: `Element`, `Area`, `User`, `Event` for API data
- Leaflet types imported but some custom extensions needed for plugins

### HTML / Accessibility

- Use semantic HTML elements (e.g., `<header>`, `<main>`, `<footer>`, `<nav>`)
- Ensure accessibility (a11y) by using appropriate ARIA roles and attributes
- If you see a potential accessibility issue, suggest improvements
- If you see a potential invalid HTML, suggest improvements

## Map Architecture (Critical)

- **Leaflet** is the core mapping library with MapLibre GL integration
- **Marker clustering** via `leaflet.markercluster` for performance with thousands of markers
- **Dynamic icon generation** based on merchant category and boost status
- **Subgroup layers** for filtering (up-to-date, outdated, legacy payment methods)
- Map state persists via URL hash and LocalForage caching

```typescript
// Key pattern: Map initialization with custom controls
let markers = L.markerClusterGroup({ maxClusterRadius: 80 });
let upToDateLayer = leaflet.featureGroup.subGroup(markers);
// Layers are dynamically built based on merchant data and filters
```

## Data Architecture & Sync

### Store Pattern

- **Svelte stores** in `src/lib/store.ts` manage global state (elements, users, events, areas)
- **LocalForage** provides persistent client-side storage with IndexedDB fallback
- **Sync modules** in `src/lib/sync/` handle incremental data updates every 10 minutes

### Critical Data Flow

1. **Initial load**: `src/routes/+layout.svelte` orchestrates all data syncing
2. **Elements sync**: Merchants fetched in 5000-item batches with `updated_since` parameter
3. **Local caching**: Data persisted to avoid re-downloading on page refresh
4. **Real-time updates**: `$mapUpdates` store triggers UI refresh when new data available

```typescript
// Pattern: Sync functions return promises and update stores
export const elementsSync = async () => {
	// Always clear old table versions first
	clearTables(['elements', 'elements_v2', 'elements_v3']);
	// Check local cache, then API if needed
	await localforage.getItem<Element[]>('elements_v4').then(async function (value) {
		/* sync logic */
	});
};
```

## Component Organization

### Component Library

- **Barrel exports**: All components exported from `src/lib/comp.ts`
- **Icon system**: Uses Material Design icons via Iconify + custom SVG spritesheets
- **Reusable patterns**: `Card`, `Icon`, `Boost` components used throughout

### Map-Specific Components

- **Map setup**: `src/lib/map/setup.ts` contains all Leaflet configuration and utilities
- **Custom controls**: Search, boost layer toggle, geolocation built as Leaflet controls
- **Popup generation**: Dynamic HTML popups with payment method icons and verification status

## Styling & Theming

### TailwindCSS v3

- **Utility-first** approach with custom color palette for Bitcoin orange/teal theme
- **Dark mode** support via `dark:` classes and theme detection
- **Custom classes**: `text-bitcoin`, `bg-teal`, `text-mapButton` for brand consistency
- **Responsive**: Mobile-first with `md:` breakpoints for desktop enhancements

## Development Workflow

### Key Commands

```bash
yarn dev          # Development server with HMR
yarn build        # Production build (requires .env from .env.example)
yarn format       # Prettier formatting (run before commits)
yarn lint         # ESLint with Svelte parser
yarn typecheck    # TypeScript validation
yarn playwright test  # E2E testing
```

### Important Files

- **Types**: `src/lib/types.ts` contains all TypeScript interfaces
- **Utils**: `src/lib/utils.ts` has theme detection, debouncing, error handling
- **PWA**: `src/service-worker.ts` enables offline functionality

## Patterns & Conventions

### URL Parameters for Map State

- Location: `?lat=40.7128&long=-74.0060` or hash `#15/40.71280/-74.00600`
- Filters: `?onchain=true&lightning=true&nfc=true&boosts=true`
- Legacy/outdated: `?legacy=true&outdated=true`

### Payment Method Integration

- **Payment URIs**: Lightning addresses, LNURL, on-chain addresses in `payment:uri` tags
- **Third-party apps**: Special handling for apps requiring companion software
- **Boost system**: Time-limited merchant highlighting with visual emphasis

### Error Handling

- **Toast notifications**: `@zerodevx/svelte-toast` for user feedback
- **Axios retry**: Automatic retry logic for API failures
- **Graceful degradation**: Map works offline with cached data

## TypeScript Guidelines

- Avoid `any` types - create proper interfaces in `src/lib/types.ts`
- OSM tag data often untyped - suggest creating `OSMTags` extensions
- Use provided types: `Element`, `Area`, `User`, `Event` for API data
- Leaflet types imported but some custom extensions needed for plugins

## Testing & Deployment

- **Playwright E2E tests** in `tests/` directory cover critical user flows
- **Netlify deployment** with build caching and PWA optimization
- **Progressive enhancement**: Core functionality works without JavaScript
