// Persisted on/off state for the merchant-density heatmap layer. The map
// control (HeatmapToggleControl) renders the toggle UI and writes the choice
// via storeHeatmapEnabled; the page seeds the initial layer visibility via
// getStoredHeatmapEnabled() so a returning user who left the heatmap on gets
// it restored on load. Off by default. Mirrors the verifiedFilter/basemaps
// persistence helpers — reads and writes are guarded so a blocked-storage
// environment (private mode, sandboxed iframe) degrades to "off" instead of
// throwing.

export const HEATMAP_STORAGE_KEY = "btcmap:heatmap-layer";

export const getStoredHeatmapEnabled = (): boolean => {
	if (typeof window === "undefined") return false;
	try {
		return localStorage.getItem(HEATMAP_STORAGE_KEY) === "true";
	} catch {
		// localStorage unavailable
		return false;
	}
};

export const storeHeatmapEnabled = (enabled: boolean): void => {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(HEATMAP_STORAGE_KEY, String(enabled));
	} catch {
		// localStorage unavailable
	}
};
