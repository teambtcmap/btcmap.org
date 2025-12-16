export const CONFETTI_CANVAS_Z_INDEX = '2001';

// Gitea label IDs grouped by repository
export const GITEA_LABELS = {
	DATA: {
		ADD_LOCATION: 901, // location-submission
		COMMUNITY_SUBMISSION: 902, // community-submission
		VERIFY_LOCATION: 903 // location-verification
	},
	INFRA: {
		TAGGER_ONBOARDING: 1410 // tagger-onboarding
	}
} as const;

export const POLLING_INTERVAL = 2500;
export const QR_CODE_SIZE = { mobile: 200, desktop: 275 };
export const PAYMENT_ERROR_MESSAGE =
	'Could not generate invoice, please try again or contact BTC Map.';
export const STATUS_CHECK_ERROR_MESSAGE =
	'Could not check invoice status, please try again or contact BTC Map.';

// Tailwind breakpoints (must match tailwind.config.js default breakpoints)
export const BREAKPOINTS = {
	sm: 640,
	md: 768,
	lg: 1024,
	xl: 1280,
	'2xl': 1536
} as const;

// Layout widths for merchant list and drawer (in pixels)
export const MERCHANT_LIST_WIDTH = 320;
export const MERCHANT_DRAWER_WIDTH = 400;

// Base padding (px) for fitBounds - visual buffer from viewport edges
export const MAP_FIT_BOUNDS_PADDING = 50;

// MERCHANT LIST ZOOM BEHAVIOR:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Zoom < 11  │ No data shown - "zoom in" message                          │
// │ Zoom 11-14 │ API search with 1.5x radius, max 99 results                │
// │ Zoom 15+   │ Use loaded markers with 1.5x bounds, enrich when open      │
// └─────────────────────────────────────────────────────────────────────────┘
// All zoom levels use 1.5x radius multiplier for consistent "nearby" count.

// Zoom 17+: Leaflet clustering disabled, individual markers shown
export const CLUSTERING_DISABLED_ZOOM = 17;

// Zoom 1-5: Boosted markers are clustered (too zoomed out, would be crowded)
// Zoom 6-16: Boosted markers are NOT clustered (stand out from regular markers)
export const BOOSTED_CLUSTERING_MAX_ZOOM = 5;

// Zoom 15+: Use loaded viewport markers (instant, no API latency)
// Fetches enriched Place data (icons, addresses) only when panel is open
export const MERCHANT_LIST_MIN_ZOOM = 15;

// Zoom 11-14: "Low density" mode - use API search with result limit
// If results exceed MERCHANT_LIST_MAX_ITEMS, we hide the list and show "zoom in"
export const MERCHANT_LIST_LOW_ZOOM = 11;

// Max merchants to display in list and count shown on button
// When count exceeds this, button shows ">99" and list shows 99 items
export const MERCHANT_LIST_MAX_ITEMS = 99;

// Radius multiplier for "nearby" search (extends beyond viewport for context)
// Used consistently across all zoom levels for predictable count behavior
export const NEARBY_RADIUS_MULTIPLIER = 1.5;

// Map viewport marker loading
export const MAX_LOADED_MARKERS = 200;
export const VIEWPORT_BATCH_SIZE = 25;
export const VIEWPORT_BUFFER_PERCENT = 0.2;
export const MAP_DEBOUNCE_DELAY = 300;
export const MARKER_CLICK_THROTTLE = 100;

// Default map position (Curaçao)
export const DEFAULT_MAP_LAT = 12.11209;
export const DEFAULT_MAP_LNG = -68.91119;
export const DEFAULT_MAP_ZOOM = 15;

export const GradeTable = `<table>
<thead>
    <tr>
        <th class='mr-1 inline-block'>Up-To-Date</th>
        <th>Grade</th>
    </tr>
</thead>
<tbody>
    <tr>
        <td>95-100%</td>
        <td>5 Star</td>
    </tr>
    <tr>
        <td>75-95%</td>
        <td>4 Star</td>
    </tr>
    <tr>
        <td>50-75%</td>
        <td>3 Star</td>
    </tr>
    <tr>
        <td>25-50%</td>
        <td>2 Star</td>
    </tr>
    <tr>
        <td>0-25%</td>
        <td>1 Star</td>
    </tr>
</tbody>
</table>`;
