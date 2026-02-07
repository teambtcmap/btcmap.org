# Marker Loading Hybrid Extraction - Detailed Implementation Plan

**Date:** 2026-02-07  
**Target File:** `src/routes/map/+page.svelte`  
**Current Size:** 1,438 lines  
**Estimated Reduction:** ~95 lines  
**Complexity:** Medium

---

## 🎯 Goals

1. Extract reusable marker creation and batch processing logic
2. Keep viewport orchestration in component (avoid 15+ parameter APIs)
3. Improve testability of pure marker creation logic
4. Reduce code duplication between worker and fallback paths

---

## 📦 Modules to Create

### **Module 1: `src/lib/map/marker-creation.ts`**

**Purpose:** Encapsulate marker creation logic (icon + marker + label) into a reusable helper.

**Function to Create:**

```typescript
import type { Leaflet, Place } from '$lib/types';
import type { Marker } from 'leaflet';
import { generateIcon, generateMarker } from '$lib/map/setup';
import { attachMarkerLabelIfVisible } from '$lib/map/labels';

type CreateMarkerOptions = {
	place: Place;
	leaflet: Leaflet;
	currentZoom: number;
	placeDetailsCache: Map<number, PlaceEnriched>;
	placesById: Map<number, Place>;
	onMarkerClick: (id: number) => void;
	onLabelUpdate?: () => void;
};

/**
 * Creates a Leaflet marker with icon and optional label
 * Encapsulates the common pattern used in worker and fallback paths
 */
export const createMarkerWithLabel = ({
	place,
	leaflet,
	currentZoom,
	placeDetailsCache,
	placesById,
	onMarkerClick,
	onLabelUpdate
}: CreateMarkerOptions): { marker: Marker; boosted: boolean } => {
	const commentsCount = place.comments || 0;
	const icon = place.icon;
	const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

	// Generate icon
	const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

	// Create marker
	const marker = generateMarker({
		lat: place.lat,
		long: place.lon,
		icon: divIcon,
		placeId: place.id,
		leaflet,
		verify: true,
		onMarkerClick: (id) => onMarkerClick(Number(id))
	});

	// Attach label if zoom level is high enough
	attachMarkerLabelIfVisible(
		marker,
		place.id,
		currentZoom,
		placeDetailsCache,
		placesById,
		boosted,
		leaflet,
		place,
		onLabelUpdate
	);

	return { marker, boosted };
};
```

**Lines Extracted:** ~30 lines  
**Usage:** Replace duplicated marker creation logic in:

- `loadMarkersInViewportFallback()` (lines 719-746)
- `loadSearchResultMarkers()` (lines 486-503)
- `processBatchOnMainThread()` (lines 1025-1051)

---

### **Module 2: `src/lib/map/batch-processor.ts`**

**Purpose:** Process batches of places from worker and add markers to layers.

**Function to Create:**

```typescript
import type { Leaflet, Place } from '$lib/types';
import type { Marker, MarkerClusterGroup } from 'leaflet';
import type { FeatureGroup } from 'leaflet';
import type { ProcessedPlace } from '$lib/workers/map-worker';
import type { LoadedMarkers } from '$lib/map/markers';
import { generateIcon, generateMarker } from '$lib/map/setup';
import { attachMarkerLabelIfVisible } from '$lib/map/labels';
import { highlightMarker } from '$lib/map/markers';

type ProcessBatchOptions = {
	batch: ProcessedPlace[];
	leaflet: Leaflet;
	currentZoom: number;
	placeDetailsCache: Map<number, PlaceEnriched>;
	placesById: Map<number, Place>;
	loadedMarkers: LoadedMarkers;
	boostedLayerMarkerIds: Set<string>;
	shouldClusterBoostedMarkers: () => boolean;
	markers: MarkerClusterGroup;
	boostedLayer: FeatureGroup;
	selectedMarkerId: number | null;
	onMarkerClick: (id: number) => void;
};

/**
 * Process a batch of places from the worker and add markers to appropriate layers
 * Performs batch DOM operations for better performance
 */
export const processBatchOnMainThread = ({
	batch,
	leaflet,
	currentZoom,
	placeDetailsCache,
	placesById,
	loadedMarkers,
	boostedLayerMarkerIds,
	shouldClusterBoostedMarkers,
	markers,
	boostedLayer,
	selectedMarkerId,
	onMarkerClick
}: ProcessBatchOptions): void => {
	const regularMarkersToAdd: Marker[] = [];
	const boostedMarkersToAdd: Marker[] = [];

	batch.forEach((element: ProcessedPlace) => {
		const { iconData } = element;
		const placeId = element.id.toString();

		// Skip if marker already loaded (double-check)
		if (loadedMarkers[placeId]) return;

		// Generate icon using pre-calculated data from worker
		const divIcon = generateIcon(
			leaflet,
			iconData.iconTmp,
			iconData.boosted,
			iconData.commentsCount
		);

		const marker = generateMarker({
			lat: element.lat,
			long: element.lon,
			icon: divIcon,
			placeId: element.id,
			leaflet,
			verify: true,
			onMarkerClick: (id) => onMarkerClick(Number(id))
		});

		attachMarkerLabelIfVisible(
			marker,
			element.id,
			currentZoom,
			placeDetailsCache,
			placesById,
			Boolean(iconData.boosted),
			leaflet,
			placesById.get(element.id)
		);

		// Route to appropriate layer based on boost status and zoom level
		if (iconData.boosted && !shouldClusterBoostedMarkers()) {
			boostedMarkersToAdd.push(marker);
			boostedLayerMarkerIds.add(placeId);
		} else {
			regularMarkersToAdd.push(marker);
		}
		loadedMarkers[placeId] = marker;
	});

	// Batch add regular markers to cluster group
	if (regularMarkersToAdd.length > 0 && markers) {
		markers.addLayers(regularMarkersToAdd);
	}

	// Add boosted markers to non-clustered layer (only at zoom > 5)
	if (boostedMarkersToAdd.length > 0 && boostedLayer) {
		boostedMarkersToAdd.forEach((m) => boostedLayer.addLayer(m));
	}

	// Highlight the selected marker if it was just loaded (may be pending from search result click)
	if ((regularMarkersToAdd.length > 0 || boostedMarkersToAdd.length > 0) && selectedMarkerId) {
		highlightMarker(loadedMarkers, selectedMarkerId);
	}
};
```

**Lines Extracted:** ~65 lines  
**Usage:** Replace `processBatchOnMainThread()` in component (line 1013-1077)

---

## 🔧 **Refactoring Steps**

### **Step 1: Create `marker-creation.ts` Helper**

**File:** `src/lib/map/marker-creation.ts`

1. Copy marker creation pattern from lines 719-746
2. Parameterize all dependencies
3. Export `createMarkerWithLabel()` function
4. Add TypeScript types for all parameters

**Dependencies Needed:**

- `place: Place` - The place to create marker for
- `leaflet: Leaflet` - Leaflet instance
- `currentZoom: number` - Current zoom level
- `placeDetailsCache: Map<number, PlaceEnriched>` - For label data
- `placesById: Map<number, Place>` - For label data
- `onMarkerClick: (id: number) => void` - Click handler
- `onLabelUpdate?: () => void` - Optional label update callback

**Returns:**

```typescript
{
	marker: Marker;
	boosted: boolean;
}
```

---

### **Step 2: Create `batch-processor.ts` Module**

**File:** `src/lib/map/batch-processor.ts`

1. Copy `processBatchOnMainThread()` from lines 1013-1077
2. Convert to exported function with options parameter
3. Add TypeScript types for all dependencies
4. Import necessary utilities

**Dependencies Needed (passed as options object):**

- `batch: ProcessedPlace[]` - The batch to process
- `leaflet: Leaflet` - Leaflet instance
- `currentZoom: number` - Current zoom level
- `placeDetailsCache: Map<number, PlaceEnriched>` - Store value
- `placesById: Map<number, Place>` - Store value
- `loadedMarkers: LoadedMarkers` - Mutable state object
- `boostedLayerMarkerIds: Set<string>` - Mutable set
- `shouldClusterBoostedMarkers: () => boolean` - Helper function
- `markers: MarkerClusterGroup` - Layer
- `boostedLayer: FeatureGroup` - Layer
- `selectedMarkerId: number | null` - Selected marker ID
- `onMarkerClick: (id: number) => void` - Click handler

**Returns:** `void` (mutates state in-place)

---

### **Step 3: Update `loadMarkersInViewportFallback()` to Use Helper**

**In:** `src/routes/map/+page.svelte` (lines 710-762)

**Replace this block (lines 719-746):**

```typescript
const commentsCount = place.comments || 0;
const icon = place.icon;
const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

const marker = generateMarker({
	lat: place.lat,
	long: place.lon,
	icon: divIcon,
	placeId: place.id,
	leaflet,
	verify: true,
	onMarkerClick: (id) => openMerchantDrawer(Number(id))
});

attachMarkerLabelIfVisible(
	marker,
	place.id,
	currentZoom,
	$merchantList.placeDetailsCache,
	$placesById,
	boosted,
	leaflet,
	place,
	() => labelTracker.incrementVersion()
);
```

**With this:**

```typescript
const { marker, boosted } = createMarkerWithLabel({
	place,
	leaflet,
	currentZoom,
	placeDetailsCache: $merchantList.placeDetailsCache,
	placesById: $placesById,
	onMarkerClick: openMerchantDrawer,
	onLabelUpdate: () => labelTracker.incrementVersion()
});
```

**Lines Saved:** ~20 lines in this function

---

### **Step 4: Update `loadSearchResultMarkers()` to Use Helper**

**In:** `src/routes/map/+page.svelte` (lines 475-527)

**Replace lines 486-503** with same pattern as Step 3.

**Lines Saved:** ~15 lines

---

### **Step 5: Replace `processBatchOnMainThread()` with Imported Function**

**In:** `src/routes/map/+page.svelte`

**Remove function definition (lines 1013-1077)**

**Add import:**

```typescript
import { processBatchOnMainThread } from '$lib/map/batch-processor';
```

**Update call site (line 688):**

```typescript
// Before:
processBatchOnMainThread(batch, upToDateLayer);

// After:
processBatchOnMainThread({
	batch,
	leaflet,
	currentZoom,
	placeDetailsCache: $merchantList.placeDetailsCache,
	placesById: $placesById,
	loadedMarkers,
	boostedLayerMarkerIds,
	shouldClusterBoostedMarkers,
	markers,
	boostedLayer,
	selectedMarkerId,
	onMarkerClick: openMerchantDrawer
});
```

**Lines Saved:** ~65 lines (function moved to module)

---

## 📝 **Detailed Implementation Sequence**

### **Phase 1: Create `marker-creation.ts`**

1. Create file `src/lib/map/marker-creation.ts`
2. Add necessary imports:
   - `generateIcon`, `generateMarker` from `$lib/map/setup`
   - `attachMarkerLabelIfVisible` from `$lib/map/labels`
   - Type imports for `Place`, `Leaflet`, `Marker`
3. Define `CreateMarkerOptions` type
4. Implement `createMarkerWithLabel()` function
5. Export function

**Expected output:** New file, ~40 lines

---

### **Phase 2: Create `batch-processor.ts`**

1. Create file `src/lib/map/batch-processor.ts`
2. Add necessary imports:
   - `generateIcon`, `generateMarker` from `$lib/map/setup`
   - `attachMarkerLabelIfVisible` from `$lib/map/labels`
   - `highlightMarker` from `$lib/map/markers`
   - Type imports for layers, markers, etc.
3. Define `ProcessBatchOptions` type
4. Copy `processBatchOnMainThread()` implementation
5. Export function

**Expected output:** New file, ~90 lines

---

### **Phase 3: Update Component to Use New Modules**

1. **Add imports to `+page.svelte`:**

   ```typescript
   import { createMarkerWithLabel } from '$lib/map/marker-creation';
   import { processBatchOnMainThread } from '$lib/map/batch-processor';
   ```

2. **Update `loadMarkersInViewportFallback()` (lines 710-762):**
   - Replace marker creation block (lines 719-746) with `createMarkerWithLabel()` call
   - Keep layer routing logic (lines 748-760)
   - **Net change:** -20 lines

3. **Update `loadSearchResultMarkers()` (lines 475-527):**
   - Replace marker creation block (lines 486-503) with `createMarkerWithLabel()` call
   - Keep layer routing logic (lines 505-516)
   - **Net change:** -15 lines

4. **Remove `processBatchOnMainThread()` function (lines 1013-1077):**
   - Delete entire function
   - **Net change:** -65 lines

5. **Update `processBatchOnMainThread()` call site (line 688):**
   - Change from `processBatchOnMainThread(batch, upToDateLayer)`
   - To full options object with all dependencies
   - **Net change:** +12 lines

---

## 🔍 **Dependency Analysis**

### **Dependencies for `createMarkerWithLabel()`**

| Dependency          | Type                         | Source                  | Mutated? |
| ------------------- | ---------------------------- | ----------------------- | -------- |
| `place`             | `Place`                      | Parameter               | No       |
| `leaflet`           | `Leaflet`                    | Component state         | No       |
| `currentZoom`       | `number`                     | Component state         | No       |
| `placeDetailsCache` | `Map<number, PlaceEnriched>` | Store (`$merchantList`) | No       |
| `placesById`        | `Map<number, Place>`         | Store (`$placesById`)   | No       |
| `onMarkerClick`     | `(id: number) => void`       | Component function      | No       |
| `onLabelUpdate`     | `() => void`                 | Optional callback       | No       |

**Total: 7 parameters (manageable)**

---

### **Dependencies for `processBatchOnMainThread()`**

| Dependency                    | Type                         | Source             | Mutated?            |
| ----------------------------- | ---------------------------- | ------------------ | ------------------- |
| `batch`                       | `ProcessedPlace[]`           | Parameter          | No                  |
| `leaflet`                     | `Leaflet`                    | Component state    | No                  |
| `currentZoom`                 | `number`                     | Component state    | No                  |
| `placeDetailsCache`           | `Map<number, PlaceEnriched>` | Store              | No                  |
| `placesById`                  | `Map<number, Place>`         | Store              | No                  |
| `loadedMarkers`               | `LoadedMarkers`              | Component state    | **Yes**             |
| `boostedLayerMarkerIds`       | `Set<string>`                | Component state    | **Yes**             |
| `shouldClusterBoostedMarkers` | `() => boolean`              | Component helper   | No                  |
| `markers`                     | `MarkerClusterGroup`         | Component state    | **Yes** (addLayers) |
| `boostedLayer`                | `FeatureGroup`               | Component state    | **Yes** (addLayer)  |
| `selectedMarkerId`            | `number \| null`             | Component state    | No                  |
| `onMarkerClick`               | `(id: number) => void`       | Component function | No                  |

**Total: 12 parameters (passed as options object)**

**Note:** This is acceptable because:

- Options object pattern keeps it manageable
- Function is called in one place (worker callback)
- Clear separation between worker processing and DOM operations

---

## 📋 **Code Changes - Before & After**

### **Change 1: `loadMarkersInViewportFallback()`**

**Location:** src/routes/map/+page.svelte:719-746

**Before:**

```typescript
placesToLoad.forEach((place: Place) => {
  const commentsCount = place.comments || 0;
  const icon = place.icon;
  const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

  const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

  const marker = generateMarker({
    lat: place.lat,
    long: place.lon,
    icon: divIcon,
    placeId: place.id,
    leaflet,
    verify: true,
    onMarkerClick: (id) => openMerchantDrawer(Number(id))
  });

  attachMarkerLabelIfVisible(
    marker,
    place.id,
    currentZoom,
    $merchantList.placeDetailsCache,
    $placesById,
    boosted,
    leaflet,
    place,
    () => labelTracker.incrementVersion()
  );

  // Route to appropriate layer...
```

**After:**

```typescript
placesToLoad.forEach((place: Place) => {
  const { marker, boosted } = createMarkerWithLabel({
    place,
    leaflet,
    currentZoom,
    placeDetailsCache: $merchantList.placeDetailsCache,
    placesById: $placesById,
    onMarkerClick: openMerchantDrawer,
    onLabelUpdate: () => labelTracker.incrementVersion()
  });

  // Route to appropriate layer...
```

---

### **Change 2: `loadSearchResultMarkers()`**

**Location:** src/routes/map/+page.svelte:486-503

**Before:**

```typescript
const commentsCount = place.comments || 0;
const icon = place.icon;
const boosted = place.boosted_until ? Date.parse(place.boosted_until) > Date.now() : false;

const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);

const marker = generateMarker({
	lat: place.lat,
	long: place.lon,
	icon: divIcon,
	placeId: place.id,
	leaflet,
	verify: true,
	onMarkerClick: (id) => openMerchantDrawer(Number(id))
});

attachMarkerLabelIfVisible(/* ... */);
```

**After:**

```typescript
const { marker, boosted } = createMarkerWithLabel({
	place,
	leaflet,
	currentZoom,
	placeDetailsCache: $merchantList.placeDetailsCache,
	placesById: $placesById,
	onMarkerClick: openMerchantDrawer
});
```

---

### **Change 3: `processBatchOnMainThread()` Function**

**Location:** src/routes/map/+page.svelte:1013-1077

**Before:**

```typescript
const processBatchOnMainThread = (batch: ProcessedPlace[], _layer: FeatureGroup.SubGroup) => {
	const regularMarkersToAdd: Marker[] = [];
	const boostedMarkersToAdd: Marker[] = [];

	batch.forEach((element: ProcessedPlace) => {
		// 50+ lines of marker creation and layer routing
	});

	// Batch add operations
	if (regularMarkersToAdd.length > 0 && markers) {
		markers.addLayers(regularMarkersToAdd);
	}
	// ...
};
```

**After:**

```typescript
// Function removed - imported from module
import { processBatchOnMainThread } from '$lib/map/batch-processor';
```

**Call site update (line 688):**

```typescript
// Before:
processBatchOnMainThread(batch, upToDateLayer);

// After:
processBatchOnMainThread({
	batch,
	leaflet,
	currentZoom,
	placeDetailsCache: $merchantList.placeDetailsCache,
	placesById: $placesById,
	loadedMarkers,
	boostedLayerMarkerIds,
	shouldClusterBoostedMarkers,
	markers,
	boostedLayer,
	selectedMarkerId,
	onMarkerClick: openMerchantDrawer
});
```

---

## 🎯 **Expected Results**

### **Line Count Changes:**

| Location                          | Before        | After         | Saved         |
| --------------------------------- | ------------- | ------------- | ------------- |
| `loadMarkersInViewportFallback()` | 53 lines      | ~38 lines     | -15           |
| `loadSearchResultMarkers()`       | 53 lines      | ~40 lines     | -13           |
| `processBatchOnMainThread()`      | 65 lines      | 0 (moved)     | -65           |
| Worker callback (line 688)        | 1 line        | ~13 lines     | +12           |
| **Net in +page.svelte**           | **172 lines** | **~91 lines** | **-81 lines** |

**New module files:**

- `src/lib/map/marker-creation.ts`: ~40 lines
- `src/lib/map/batch-processor.ts`: ~90 lines

**Total new code:** ~130 lines (includes types + exports)

**Final +page.svelte size:** 1438 - 81 = **~1357 lines**

---

## 🧪 **Testing Strategy**

### **What to Test After Refactoring:**

1. **Marker creation still works:**
   - Pan around map, verify markers load
   - Zoom in/out, check marker layer transitions
   - Verify boosted markers appear on separate layer

2. **Worker path still functional:**
   - Test with modern browser (Chrome/Firefox)
   - Verify batches process correctly
   - Check console for worker-related errors

3. **Fallback path still functional:**
   - Test fallback scenario (if possible)
   - Verify synchronous loading works

4. **Search results:**
   - Search for a location
   - Verify search result markers load
   - Check category filtering works

5. **Selected marker highlighting:**
   - Click a marker
   - Verify it highlights correctly
   - Pan to load more markers, ensure highlight persists

6. **Label updates:**
   - Zoom to 15+ (label visible zoom)
   - Verify labels appear on markers
   - Check label updates when place details load

---

## ⚠️ **Potential Issues & Mitigation**

### **Issue 1: Store Reactivity**

**Problem:** Passing `$merchantList.placeDetailsCache` as value loses reactivity.

**Solution:** This is acceptable because:

- Values are read **at call time** (not stored)
- Functions are called in response to user actions (pan/zoom)
- Each call gets fresh store values via `$` syntax

**Verification:** Ensure markers update correctly when store values change.

---

### **Issue 2: Mutable State Passing**

**Problem:** `loadedMarkers`, `boostedLayerMarkerIds` are mutated inside extracted function.

**Solution:** This is acceptable because:

- Objects/Sets are passed by reference
- Mutations are intentional (shared state)
- Alternative (callbacks) would be more complex

**Verification:** Check that `loadedMarkers` object is populated correctly after batch processing.

---

### **Issue 3: `shouldClusterBoostedMarkers` Reference**

**Problem:** Need to pass component-local helper function.

**Solution:**

- Pass as callback: `shouldClusterBoostedMarkers: () => boolean`
- Simple one-liner that reads `currentZoom` from component scope
- Could also inline: `shouldClusterBoostedMarkers: () => currentZoom <= BOOSTED_CLUSTERING_MAX_ZOOM`

**Verification:** Ensure boosted markers transition between layers correctly at zoom threshold (5 → 6).

---

### **Issue 4: `onLabelUpdate` Optional Parameter**

**Problem:** Only `loadMarkersInViewportFallback()` uses `labelTracker.incrementVersion()`, not worker path.

**Solution:**

- Make `onLabelUpdate` optional in helper: `onLabelUpdate?: () => void`
- Worker path (via `processBatchOnMainThread`) doesn't pass it
- Fallback path passes `() => labelTracker.incrementVersion()`
- Update `attachMarkerLabelIfVisible` call to handle undefined callback

**Verification:**

- Check that fallback path updates label tracker
- Verify worker path doesn't break without callback

---

### **Issue 5: PlaceEnriched Type Import**

**Problem:** `PlaceEnriched` type may not be exported from merchantListStore.

**Current code:** Uses `$merchantList.placeDetailsCache` which is `Map<number, PlaceEnriched>`

**Solutions:**

1. Export `PlaceEnriched` type from `$lib/merchantListStore.ts`
2. OR use `Map<number, unknown>` if type not needed
3. OR create type in `$lib/types.ts`

**Action:** Check if `PlaceEnriched` is already exported, if not export it.

---

## 🔄 **Code Review Checklist**

Before committing, verify:

- [ ] `createMarkerWithLabel()` exported from `marker-creation.ts`
- [ ] `processBatchOnMainThread()` exported from `batch-processor.ts`
- [ ] All imports added to `+page.svelte`
- [ ] `loadMarkersInViewportFallback()` updated correctly (lines 710-762)
- [ ] `loadSearchResultMarkers()` updated correctly (lines 475-527)
- [ ] `processBatchOnMainThread()` function removed (lines 1013-1077)
- [ ] Worker callback updated with options object (line 688)
- [ ] TypeScript types are correct (no `any`)
- [ ] `PlaceEnriched` type exported if needed
- [ ] `yarn run format:fix` passes
- [ ] `yarn run check` passes (0 errors)
- [ ] `yarn run lint` passes
- [ ] `yarn run test --run` passes
- [ ] Manual testing shows markers load correctly
- [ ] Verify worker path works (check browser console)
- [ ] Verify fallback path works
- [ ] Verify search result markers load
- [ ] Verify selected marker highlighting
- [ ] Verify label updates work

---

## 📊 **Summary**

### **What Gets Extracted:**

- ✅ Marker creation pattern (~30 lines of logic, reused 3x)
- ✅ Batch processor function (~65 lines)
- ✅ **Total: ~95 lines** moved to reusable modules

### **What Stays in Component:**

- ✅ `loadMarkersInViewport()` - Viewport orchestration, worker coordination
- ✅ `loadMarkersInViewportFallback()` - Fallback orchestration (now simpler)
- ✅ `debouncedLoadMarkers` - Debounced version
- ✅ State management (`isLoadingMarkers`, `loadedMarkers`, layers)

### **Benefits:**

- ✅ **Eliminates code duplication** (marker creation used 3x)
- ✅ **Better testability** (pure functions can be unit tested)
- ✅ **Cleaner separation** (DOM operations vs business logic)
- ✅ **Reasonable complexity** (7-12 parameters, not 15+)
- ✅ **Maintains readability** (orchestration still in component)

### **Tradeoffs:**

- ❌ Slightly more verbose call sites (options objects)
- ❌ Two new files to maintain
- ❌ Some ceremony around parameter passing
- ✅ But: Better organized, more reusable, easier to test

---

## 🚀 **Commit Message**

```
refactor(map): extract marker creation and batch processing

- Create marker-creation helper for reusable marker creation logic
- Extract batch processor to separate module for worker integration
- Eliminate code duplication across 3 marker creation sites
- Reduce +page.svelte by ~81 lines while improving testability

🤖 Generated with [opencode](https://opencode.ai)
```

---

## ❓ **Open Questions (Need Resolution Before Implementation)**

### **1. PlaceEnriched Type**

**Question:** Is `PlaceEnriched` type already exported from `$lib/merchantListStore.ts`?

**Action needed:**

- Check if type exists and is exported
- If not exported, export it: `export type PlaceEnriched = ...`
- OR use alternative approach (create in types.ts or use unknown)

**Impact:** Required for type safety in new modules

---

### **2. Error Handling in `createMarkerWithLabel()`**

**Question:** Should the helper have try-catch around marker creation, or let caller handle errors?

**Options:**

- **A)** Let caller handle (throws on error) - **Recommended**
  - Caller already has error handling in place
  - Cleaner separation of concerns
- **B)** Add try-catch in helper (returns null on error)
  - More defensive
  - Hides errors from caller

**Recommendation:** Option A (let caller handle)

---

### **3. Function Naming**

**Question:** Is `createMarkerWithLabel` the best name?

**Alternatives:**

- `createMarkerWithLabel()` - Current proposal (descriptive)
- `buildMarkerForPlace()` - Emphasizes "for a place"
- `createPlaceMarker()` - Shorter
- `generatePlaceMarkerWithLabel()` - Matches existing `generateMarker` naming

**Recommendation:** Keep `createMarkerWithLabel()` (clear and descriptive)

---

### **4. Unit Tests**

**Question:** Should we add unit tests for these new modules?

**Options:**

- **A)** Add unit tests now
  - Better coverage
  - Validates extraction correctness
  - More time investment
- **B)** Rely on existing e2e tests
  - Faster implementation
  - Tests actual usage
  - Less isolated testing

**Recommendation:** Option B for now (existing tests should catch issues), add unit tests in future if needed.

---

### **5. `onLabelUpdate` Callback Handling**

**Question:** How should `attachMarkerLabelIfVisible` handle undefined `onLabelUpdate` callback?

**Current code:** Always passes callback in fallback, never in worker path.

**Action needed:**

- Check if `attachMarkerLabelIfVisible` handles undefined callback
- If not, make it optional in the function signature
- OR always pass a no-op: `onLabelUpdate: onLabelUpdate || (() => {})`

**Impact:** May need update to `$lib/map/labels.ts`

---

## 📁 **File Structure After Extraction**

```
src/lib/map/
├── imports.ts              (existing - 25 lines)
├── labels.ts               (existing - ~200 lines)
├── markers.ts              (existing - ~150 lines)
├── setup.ts                (existing - ~450 lines)
├── viewport.ts             (existing - ~100 lines)
├── marker-creation.ts      (NEW - ~40 lines)
└── batch-processor.ts      (NEW - ~90 lines)

src/routes/map/
├── +page.svelte            (1438 → ~1357 lines)
└── components/
    └── MapControls.svelte  (73 lines)
```

---

## 🎬 **Implementation Checklist**

### **Pre-Implementation:**

- [ ] Review this plan with team/stakeholder
- [ ] Answer open questions (1-5 above)
- [ ] Verify `PlaceEnriched` type availability
- [ ] Check `attachMarkerLabelIfVisible` signature for optional callback

### **Implementation:**

- [ ] Create `src/lib/map/marker-creation.ts`
- [ ] Create `src/lib/map/batch-processor.ts`
- [ ] Add imports to `+page.svelte`
- [ ] Update `loadMarkersInViewportFallback()` to use helper
- [ ] Update `loadSearchResultMarkers()` to use helper
- [ ] Update `processBatchOnMainThread()` call site
- [ ] Remove `processBatchOnMainThread()` function definition
- [ ] Run `yarn run format:fix` (MANDATORY)
- [ ] Run `yarn run check` (type checking)
- [ ] Run `yarn run lint` (linting)
- [ ] Run `yarn run test --run` (unit tests)

### **Testing:**

- [ ] Pan around map, verify markers load
- [ ] Zoom in/out, check transitions
- [ ] Test search results
- [ ] Test marker selection/highlighting
- [ ] Test boosted marker layer transitions
- [ ] Verify labels appear at zoom 15+
- [ ] Check browser console for errors

### **Commit:**

- [ ] Review changes with `git diff`
- [ ] Stage files: `git add src/lib/map/marker-creation.ts src/lib/map/batch-processor.ts src/routes/map/+page.svelte`
- [ ] Commit with message: `refactor(map): extract marker creation and batch processing`
- [ ] Verify commit with `git log -1 --stat`

---

## 📈 **Progress Tracking**

### **Completed Extractions:**

1. ✅ MapControls component - 43 lines saved (Commit: `11a9f906`)
2. ✅ onMount split into 6 functions - 0 net lines, better organization (Commit: `f5ee061e`)

### **This Extraction:**

3. 🔄 Marker loading hybrid - ~81 lines saved (Planned)

### **Total Progress:**

- **Starting size:** 1,445 lines
- **Current size:** 1,438 lines
- **After this:** ~1,357 lines
- **Total reduction:** ~88 lines (6% reduction)
- **Organizational improvement:** Significant (modular, testable, reusable)

---

## 🔮 **Future Opportunities**

After this extraction, consider:

1. **Marker Filtering Module** (~110 lines) - Lines 418-527
2. **Merchant List Updater** (~74 lines) - Lines 782-855
3. **Move Setup Functions** to initialization.ts (~210 lines)
4. **Elements Initialization** (~84 lines) - Lines 927-1010

**Potential final size:** ~450-550 lines (68% reduction from original 1,445)

---

**Estimated Implementation Time:** 30-40 minutes  
**Risk Level:** Medium (touching critical marker loading path)  
**Testing Required:** Manual map testing + automated tests  
**Confidence Level:** High (well-scoped, clear boundaries)
