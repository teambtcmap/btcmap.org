# BTC Map Development Guide

## Build/Test Commands

- `yarn dev` - Start development server with HMR
- `yarn build` - Production build
- `yarn check` - TypeScript + Svelte validation
- `yarn lint` - ESLint check
- `yarn lint:fix` - Auto-fix ESLint issues
- `yarn format:fix` - **REQUIRED before every commit** - Prettier formatting
- `yarn typecheck` - TypeScript type checking
- `yarn playwright test` - Run all E2E tests
- `yarn playwright test tests/home.spec.ts` - Run single test file
- `yarn playwright test --headed` - Run tests with browser UI

## Code Style (Auto-enforced)

- **Tabs** for indentation, **single quotes**, **no trailing commas**
- **100 char line limit**, TailwindCSS class sorting enabled
- **TypeScript required** - avoid `any`, create types in `src/lib/types.ts`
- **Svelte v4** conventions - use stores, reactive statements, proper lifecycle
- **TailwindCSS v3** utility-first, custom Bitcoin orange/teal theme
- **Imports**: Barrel exports from `src/lib/comp.ts`, absolute paths preferred

## Architecture

- **SvelteKit** file-based routing, SSR for SEO pages
- **Leaflet + MapLibre** for interactive maps with clustering
- **LocalForage** client-side caching, sync every 10min from API
- **Mobile-first PWA** with offline support via service worker

## Map Performance Optimizations

- **Hybrid viewport + web worker loading**: Only load markers visible in current viewport
- **Lazy worker initialization**: Web workers initialized only when needed with proper feature detection
- **Viewport-based filtering**: 20% buffer around visible area for smooth panning
- **Memory management**: Cleanup out-of-bounds markers when >200 markers loaded
- **Debounced loading**: 300ms debounce on map movement to prevent excessive API calls
- **Batch processing**: 25-marker batches for optimal performance in viewport
- **MessageChannel yielding**: Proper event loop yielding in workers (no setTimeout)

## Performance Constants (Configurable)

```javascript
const MAX_LOADED_MARKERS = 200; // Memory cleanup threshold
const VIEWPORT_BATCH_SIZE = 25; // Worker batch size for viewport
const VIEWPORT_BUFFER_PERCENT = 0.2; // 20% buffer around viewport
const DEBOUNCE_DELAY = 300; // Map movement debounce (ms)
```

## Error Handling

- Use `@zerodevx/svelte-toast` for user notifications
- Axios retry logic for API failures, graceful offline degradation
- Proper TypeScript error types, avoid silent failures
- Web worker fallback to synchronous processing when workers unavailable
