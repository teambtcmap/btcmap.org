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

// Zoom level at which marker clustering is disabled and individual markers are shown
// Also used as threshold for showing the merchant list panel
export const CLUSTERING_DISABLED_ZOOM = 17;

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
