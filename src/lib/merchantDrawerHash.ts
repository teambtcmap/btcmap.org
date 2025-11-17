import { browser } from '$app/environment';

export type DrawerView = 'details' | 'boost' | 'comments';

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

	if (ampIndex !== -1) {
		const params = new URLSearchParams(hash.substring(ampIndex + 1));
		const merchantParam = params.get('merchant');
		const viewParam = params.get('view');

		const merchantId = merchantParam ? Number(merchantParam) : null;

		// Validate view parameter against allowed values
		const validViews: DrawerView[] = ['details', 'boost', 'comments'];
		const drawerView: DrawerView =
			viewParam && validViews.includes(viewParam as DrawerView)
				? (viewParam as DrawerView)
				: 'details';

		const isOpen = Boolean(merchantId);

		return { merchantId, drawerView, isOpen };
	}

	return { merchantId: null, drawerView: 'details', isOpen: false };
}

export function updateMerchantHash(merchantId: number | null, view: DrawerView = 'details') {
	if (typeof window === 'undefined') return;

	const hash = window.location.hash.substring(1);
	const ampIndex = hash.indexOf('&');
	const mapPart = ampIndex !== -1 ? hash.substring(0, ampIndex) : hash;

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
