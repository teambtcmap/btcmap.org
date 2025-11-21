import { browser } from '$app/environment';

export type DrawerView = 'details' | 'boost';

export interface MerchantHashState {
	merchantId: number | null;
	drawerView: DrawerView;
	isOpen: boolean;
}

export function parseMerchantHash(): MerchantHashState {
	if (!browser) {
		return { merchantId: null, drawerView: 'details', isOpen: false };
	}

	const hash = window.location.hash.substring(1);
	const ampIndex = hash.indexOf('&');

	// Extract the merchant parameters
	// Check if there's a map part (contains '/') before the ampersand
	// If yes: params are after the '&' (e.g., "#14/10.24/-67.58&merchant=123")
	// If no: entire hash is params (e.g., "#merchant=123" or "#merchant=123&view=boost")
	let paramsString: string;
	if (ampIndex !== -1 && hash.substring(0, ampIndex).includes('/')) {
		// Map coordinates present, params are after ampersand
		paramsString = hash.substring(ampIndex + 1);
	} else {
		// No map coordinates, entire hash is params
		paramsString = hash;
	}

	const params = new URLSearchParams(paramsString);
	const merchantParam = params.get('merchant');
	const viewParam = params.get('view');

	// Validate merchant ID: must be a positive integer
	let merchantId: number | null = null;
	if (merchantParam) {
		const parsedId = Number(merchantParam);
		if (!isNaN(parsedId) && parsedId > 0 && Number.isInteger(parsedId)) {
			merchantId = parsedId;
		}
	}

	// Validate view parameter against allowed values
	const validViews: DrawerView[] = ['details', 'boost'];
	const drawerView: DrawerView =
		viewParam && validViews.includes(viewParam as DrawerView)
			? (viewParam as DrawerView)
			: 'details';

	const isOpen = Boolean(merchantId);

	return { merchantId, drawerView, isOpen };
}

export function updateMerchantHash(merchantId: number | null, view: DrawerView = 'details') {
	if (typeof window === 'undefined') return;

	const hash = window.location.hash.substring(1);
	const ampIndex = hash.indexOf('&');

	// Extract map coordinates (if present) - check if it contains '/'
	let mapPart = '';
	if (ampIndex !== -1) {
		// Has ampersand - check if part before it is map coords
		const beforeAmp = hash.substring(0, ampIndex);
		if (beforeAmp.includes('/')) {
			mapPart = beforeAmp;
		}
	} else if (hash.includes('/')) {
		// No ampersand, but hash contains '/' - it's just map coords
		mapPart = hash;
	}

	if (merchantId) {
		const params = new URLSearchParams();
		params.set('merchant', String(merchantId));
		if (view !== 'details') {
			params.set('view', view);
		}

		if (mapPart) {
			window.location.hash = `${mapPart}&${params.toString()}`;
		} else {
			window.location.hash = params.toString();
		}
	} else {
		window.location.hash = mapPart || '';
	}
}
