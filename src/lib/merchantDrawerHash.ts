import { browser } from "$app/environment";

export type DrawerView = "details" | "boost";

export interface MerchantHashState {
	merchantId: number | null;
	drawerView: DrawerView;
	isOpen: boolean;
}

export const MERCHANT_URL_CHANGE_EVENT = "merchant-url-change";

export function parseMerchantHash(): MerchantHashState {
	if (!browser) {
		return { merchantId: null, drawerView: "details", isOpen: false };
	}

	const search = window.location.search;
	if (!search) {
		return { merchantId: null, drawerView: "details", isOpen: false };
	}

	const params = new URLSearchParams(search);
	const merchantParam = params.get("merchant");
	const viewParam = params.get("view");

	let merchantId: number | null = null;
	if (merchantParam) {
		const parsedId = Number(merchantParam);
		if (!Number.isNaN(parsedId) && parsedId > 0 && Number.isInteger(parsedId)) {
			merchantId = parsedId;
		}
	}

	const validViews: DrawerView[] = ["details", "boost"];
	const drawerView: DrawerView =
		viewParam && validViews.includes(viewParam as DrawerView)
			? (viewParam as DrawerView)
			: "details";

	const isOpen = Boolean(merchantId);

	return { merchantId, drawerView, isOpen };
}

export function updateMerchantHash(
	merchantId: number | null,
	view: DrawerView = "details",
) {
	if (typeof window === "undefined") return;

	const url = new URL(window.location.href);
	url.hash = window.location.hash;

	if (merchantId) {
		url.searchParams.set("merchant", String(merchantId));
		if (view !== "details") {
			url.searchParams.set("view", view);
		} else {
			url.searchParams.delete("view");
		}
	} else {
		url.searchParams.delete("merchant");
		url.searchParams.delete("view");
	}

	history.pushState(null, "", url.toString());
	window.dispatchEvent(new Event(MERCHANT_URL_CHANGE_EVENT));
}

// Canonical /map deep link to a single merchant. The merchant id goes in the
// query string (read by parseMerchantHash above and by the server-side
// OG-image loader in map/+page.server.ts), while the viewport goes in the hash
// (read by parseHashCoords in $lib/map/mapHash). Both readers must agree with
// this format — the round-trip is covered in merchantDrawerHash.test.ts. Do
// NOT move the merchant into the hash: the fragment is never sent to the
// server, and parseMerchantHash only reads window.location.search.
export function buildMerchantMapHref(
	merchantId: number | string,
	lat: number,
	lng: number,
	zoom = 18,
): string {
	return `/map?merchant=${merchantId}#${zoom}/${lat}/${lng}`;
}
