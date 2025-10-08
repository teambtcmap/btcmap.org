# Merchant Components Migration Analysis

## Overview

Analysis of merchant-related components still using old Element patterns and their migration difficulty to Place patterns.

## Components Still Using Old Element Patterns

### 1. MerchantCard.svelte ❌

**Status:** Still uses Element type

```typescript
export let merchant: Element; // Old Element type
const icon = merchant.tags['icon:android']; // Old nested tags structure
const { tags } = merchant.osm_json; // Old osm_json structure
```

### 2. AreaMerchantHighlights.svelte ❌

**Status:** Uses Element[] type

```typescript
export let filteredElements: Element[]; // Old Element array type
filteredElements.filter((e) => isBoosted(e)); // Uses Element structure
```

### 3. Merchant Detail Page (+page.server.ts) ❌

**Status:** Server-side uses v2/elements API

```typescript
const response = await axios.get(`https://api.btcmap.org/v2/elements/${id}`);
const data: Element = response.data; // Old Element type
```

## Hybrid Data Flow in AreaPage.svelte

The `AreaPage.svelte` has a complex hybrid approach:

1. **Starts with Place data** from `$places` store (new v4 API)
2. **Geographic filtering** on Place objects
3. **Converts back to Element data** by fetching from v2/elements API
4. **Returns Element[]** for compatibility with existing components

```typescript
// Geographic filtering on Place objects (new)
const areaPlaces = allPlaces.filter((place: Place) => {
	return place.lat && place.lon && geoContains(rewoundPoly, [place.lon, place.lat]);
});

// Converts back to Element data (old)
return axios.get(`https://api.btcmap.org/v2/elements/${place.osm_id}`);
```

## Migration Difficulty Assessment

### Easiest to Migrate: AreaMerchantHighlights.svelte 🟢

**Why easiest:**

- **Minimal changes needed**: Only needs type change from `Element[]` to `Place[]`
- **Simple filtering logic**: Just needs to update `isBoosted()` calls and date sorting
- **No complex data access**: Doesn't access nested `tags` or `osm_json` structures
- **Single responsibility**: Just passes data to MerchantCard

**Required changes:**

```typescript
// Before
export let filteredElements: Element[];
$: boosts = filteredElements
	.filter((e) => isBoosted(e))
	.toSorted(
		(a, b) => Date.parse(b.tags['boost:expires'] || '') - Date.parse(a.tags['boost:expires'] || '')
	);

// After
export let filteredPlaces: Place[];
$: boosts = filteredPlaces
	.filter((p) => isBoosted(p))
	.toSorted((a, b) => Date.parse(b.boosted_until || '') - Date.parse(a.boosted_until || ''));
```

### Medium Difficulty: Merchant Detail Page Server-Side 🟡

**Why medium:**

- **API migration needed**: Switch from v2/elements to v4/places API
- **Data structure changes**: Need to map Place fields to the expected output format
- **Backward compatibility**: Client-side still expects certain data shapes

### Hardest to Migrate: MerchantCard.svelte 🔴

**Why hardest:**

- **Heavy Element dependency**: Accesses `merchant.tags`, `merchant.osm_json.tags`, nested structures throughout
- **Complex data transformations**: Many conditional accesses to nested properties
- **UI logic tied to Element structure**: Boost status, verification, contact info all use Element patterns

## Migration Strategy Recommendation

1. **Start with AreaMerchantHighlights** - Quick win, minimal risk
2. **Update AreaPage data flow** - Change `filteredElements` to `filteredPlaces`
3. **Migrate MerchantCard** - Major refactor to use Place structure
4. **Update server-side** - Switch merchant detail to v4/places API

**AreaMerchantHighlights** is the clear easiest target since it requires only type changes and simple property updates, with no complex nested data access patterns to refactor.
