export const CONFETTI_CANVAS_Z_INDEX = '2001';
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

// MERCHANT LIST ZOOM BEHAVIOR:
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ Zoom < 11  │ No data shown - "zoom in" message                          │
// │ Zoom 11-14 │ API search, but hide list if > 50 results (too dense)      │
// │ Zoom 15-16 │ Use loaded markers, fetch enriched data when panel open    │
// │ Zoom 17+   │ API search with extended radius (clustering disabled)      │
// └─────────────────────────────────────────────────────────────────────────┘

// Zoom 17+: Leaflet clustering disabled, individual markers shown
// At this zoom, we use API search for accurate nearby count
export const CLUSTERING_DISABLED_ZOOM = 17;

// Zoom 15-16: "Normal" mode - filter by loaded viewport markers
// Fetches enriched Place data (icons, addresses) only when panel is open
export const MERCHANT_LIST_MIN_ZOOM = 15;

// Zoom 11-14: "Low density" mode - use API search with result limit
// If results exceed MERCHANT_LIST_MAX_ITEMS, we hide the list and show "zoom in"
export const MERCHANT_LIST_LOW_ZOOM = 11;

// Max merchants to display in list; API results exceeding this trigger "zoom in" message
export const MERCHANT_LIST_MAX_ITEMS = 50;

// Radius multiplier for API search at high zoom (extends beyond viewport for context)
export const HIGH_ZOOM_RADIUS_MULTIPLIER = 2;

// Minimum search radius in km (ensures results even at very high zoom levels)
export const MIN_SEARCH_RADIUS_KM = 1;

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
