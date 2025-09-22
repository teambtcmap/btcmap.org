# Mobile Performance Analysis: Map Loading Issues

## Problem Summary

**Issues Reported:**

- When clicking "open map" on mobile browsers, nothing happens for a long time and the site freezes
- Even when the map opens, the loading bar completes but some markers don't show icons
- Very long time until the map becomes usable on mobile devices
- Desktop performance is smooth

## Critical Performance Bottlenecks

### 1. **Heavy Synchronous Data Processing on Main Thread**

- **Location**: `src/routes/map/+page.svelte` lines 148-174 (`initializeElements()`)
- **Issue**: The `$places.forEach()` loop processes **all places synchronously** on the main thread, creating thousands of DOM elements and Leaflet markers at once
- **Impact**: On mobile devices with limited CPU/memory, this blocks the UI thread causing the "freeze" behavior
- **Code Pattern**:
  ```javascript
  $places.forEach((element: Place) => {
    // Synchronous processing of potentially 10k+ places
    const divIcon = generateIcon(leaflet, icon, boosted, commentsCount);
    let marker = generateMarker({...});
    upToDateLayer.addLayer(marker);
  });
  ```

### 2. **Expensive Icon Generation for Every Marker**

- **Location**: `src/lib/map/setup.ts` lines 565-602 (`generateIcon()`)
- **Issue**: Each marker creates a new Svelte component instance (`new Icon()`) and complex DOM structure with positioning calculations
- **Impact**: For thousands of markers, this creates massive DOM overhead and memory pressure on mobile
- **Code Pattern**:
  ```javascript
  new Icon({
  	target: iconElement,
  	props: {
  		w: '20',
  		h: '20',
  		style: `${className} mt-[5.75px] text-white`,
  		icon: iconTmp,
  		type: 'material'
  	}
  });
  ```

### 3. **Blocking Data Sync During Map Initialization**

- **Location**: `src/routes/+layout.svelte` lines 35-50
- **Issue**: `elementsSync()` loads large datasets (potentially 10k+ places) before map becomes interactive
- **Impact**: Mobile browsers struggle with large LocalForage operations and network requests
- **Code Pattern**:
  ```javascript
  await Promise.allSettled([
  	elementsSync(), // Loads all places data
  	eventsSync(),
  	usersSync(),
  	areasSync(),
  	reportsSync()
  ]);
  ```

### 4. **Inefficient Marker Clustering Setup**

- **Location**: `src/routes/map/+page.svelte` line 143
- **Issue**: All markers are added to cluster group at once without batching or viewport-based loading
- **Impact**: Mobile devices can't handle rendering thousands of clustered markers simultaneously
- **Code Pattern**:
  ```javascript
  let markers = L.markerClusterGroup({ maxClusterRadius: 80, disableClusteringAtZoom: 17 });
  // All markers added at once without batching
  ```

### 5. **Heavy Popup Generation on Demand**

- **Location**: `src/lib/map/setup.ts` lines 658-976 (`generateMarker` click handler)
- **Issue**: Each marker click triggers API request + complex DOM generation with inline styles
- **Impact**: Mobile network latency + DOM manipulation causes delayed popup rendering
- **Code Pattern**:
  ```javascript
  marker.on('click', async () => {
  	const response = await axios.get(`https://api.btcmap.org/v4/places/${placeId}?fields=...`);
  	// Complex DOM generation with 100+ lines of HTML template
  	popupContent.innerHTML = `...very long template...`;
  });
  ```

## Secondary Performance Issues

### 6. **Multiple Heavy Library Imports**

- **Location**: `src/routes/map/+page.svelte` lines 183-191
- **Issue**: Dynamic imports of Leaflet plugins happen during map initialization
- **Impact**: Mobile devices struggle with loading multiple large JavaScript modules
- **Code Pattern**:
  ```javascript
  const maplibreGl = await import('maplibre-gl');
  const maplibreGlLeaflet = await import('@maplibre/maplibre-gl-leaflet');
  const leafletLocateControl = await import('leaflet.locatecontrol');
  const leafletMarkerCluster = await import('leaflet.markercluster');
  const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
  ```

### 7. **Inefficient Theme Detection and Icon Switching**

- **Location**: Throughout `src/lib/map/setup.ts`
- **Issue**: Theme detection happens multiple times during initialization, causing icon reloads
- **Impact**: Additional DOM manipulation and asset loading on mobile

### 8. **Large Data Payload Loading**

- **Location**: `src/lib/sync/places.ts` lines 64-76
- **Issue**: Static CDN loads entire places dataset (~10k+ records) at once
- **Impact**: Mobile network bandwidth and memory constraints
- **Code Pattern**:
  ```javascript
  const staticResponse = await axios.get<Place[]>('https://cdn.static.btcmap.org/api/v4/places.json');
  ```

### 9. **Reactive Store Updates Triggering Re-renders**

- **Location**: `src/routes/map/+page.svelte` line 176
- **Issue**: Reactive statement triggers `initializeElements()` which processes all data again
- **Impact**: Potential double-processing on mobile devices
- **Code Pattern**:
  ```javascript
  $: $places && $places.length && mapLoaded && !elementsLoaded && initializeElements();
  ```

## Performance Optimization Plan

### **Phase 1: Critical Fixes (High Impact)**

1. **Implement Batched Marker Processing**
   - Use `requestAnimationFrame()` to batch marker creation
   - Process markers in chunks of 50-100 to avoid blocking UI thread
   - Show progressive loading indicator

2. **Optimize Icon Generation**
   - Pre-generate common icon combinations
   - Use CSS sprites instead of individual Svelte components
   - Cache generated icons in memory

3. **Implement Viewport-Based Loading**
   - Only load markers visible in current map bounds
   - Load additional markers as user pans/zooms
   - Use intersection observer for efficient viewport detection

4. **Defer Non-Critical Data Loading**
   - Load places data first, defer events/users/areas/reports
   - Make map interactive before all data is loaded
   - Show partial data while background sync continues

### **Phase 2: Secondary Optimizations (Medium Impact)**

5. **Optimize Library Loading**
   - Bundle critical Leaflet plugins with main bundle
   - Lazy load non-essential plugins after map is interactive
   - Use dynamic imports only for optional features

6. **Implement Popup Caching**
   - Cache popup content after first load
   - Pre-fetch popup data for visible markers
   - Use lighter popup template for mobile

7. **Optimize Data Sync Strategy**
   - Implement progressive data loading (essential fields first)
   - Use service worker for background data updates
   - Compress API responses with gzip/brotli

### **Phase 3: Advanced Optimizations (Lower Impact)**

8. **Implement Virtual Clustering**
   - Use canvas-based rendering for distant clusters
   - Switch to DOM markers only at high zoom levels
   - Implement custom clustering algorithm optimized for mobile

9. **Add Performance Monitoring**
   - Track marker rendering times
   - Monitor memory usage during map operations
   - Add performance budgets for mobile devices

10. **Optimize Asset Loading**
    - Use WebP images with fallbacks
    - Implement icon sprite sheets
    - Add resource hints for critical assets

## Recommended Implementation Order

1. **Immediate (Week 1)**: Batched marker processing + viewport-based loading
2. **Short-term (Week 2-3)**: Icon optimization + deferred data loading
3. **Medium-term (Month 1)**: Library optimization + popup caching
4. **Long-term (Month 2+)**: Virtual clustering + advanced optimizations

## Success Metrics

- **Map load time**: < 3 seconds on mobile 3G
- **Time to interactive**: < 5 seconds on mobile devices
- **Memory usage**: < 100MB peak during map operations
- **Frame rate**: Maintain 30+ FPS during pan/zoom operations
- **Marker visibility**: 100% icon rendering success rate
