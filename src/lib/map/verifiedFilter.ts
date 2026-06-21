// Persisted "verified within N years" map filter. Mirrors basemaps.ts: the
// map control owns the UI + localStorage; the page seeds the initial value and
// the merchant store holds the runtime selection. `null` is the "Any" (off)
// state — show everything, matching how the category filter defaults to "all".

export type VerifiedFilterYears = 1 | 2 | 3 | null;

export const VERIFIED_FILTER_STORAGE_KEY = "btcmap-next-verified-filter";

// Order here drives the popover order. `labelKey` points at an i18n key.
export const VERIFIED_FILTER_OPTIONS: {
	value: VerifiedFilterYears;
	labelKey: string;
}[] = [
	{ value: null, labelKey: "verificationFilter.any" },
	{ value: 1, labelKey: "verificationFilter.within1Year" },
	{ value: 2, labelKey: "verificationFilter.within2Years" },
	{ value: 3, labelKey: "verificationFilter.within3Years" },
];

export const isVerifiedFilterYears = (v: unknown): v is 1 | 2 | 3 =>
	v === 1 || v === 2 || v === 3;

export const getStoredVerifiedFilter = (): VerifiedFilterYears => {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(VERIFIED_FILTER_STORAGE_KEY);
		if (raw) {
			const n = Number(raw);
			if (isVerifiedFilterYears(n)) return n;
		}
	} catch {
		// localStorage unavailable
	}
	return null;
};

export const storeVerifiedFilter = (years: VerifiedFilterYears): void => {
	if (typeof window === "undefined") return;
	try {
		if (years == null) {
			localStorage.removeItem(VERIFIED_FILTER_STORAGE_KEY);
		} else {
			localStorage.setItem(VERIFIED_FILTER_STORAGE_KEY, String(years));
		}
	} catch {
		// localStorage unavailable
	}
};
