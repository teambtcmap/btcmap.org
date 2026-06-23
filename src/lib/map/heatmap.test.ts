import { afterEach, describe, expect, it } from "vitest";

import {
	getStoredHeatmapEnabled,
	HEATMAP_STORAGE_KEY,
	storeHeatmapEnabled,
} from "./heatmap";

describe("heatmap persistence", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("defaults to off when nothing is stored", () => {
		expect(getStoredHeatmapEnabled()).toBe(false);
	});

	it("round-trips the enabled state through localStorage", () => {
		storeHeatmapEnabled(true);
		expect(localStorage.getItem(HEATMAP_STORAGE_KEY)).toBe("true");
		expect(getStoredHeatmapEnabled()).toBe(true);
	});

	it('treats any value other than "true" as off', () => {
		storeHeatmapEnabled(false);
		expect(localStorage.getItem(HEATMAP_STORAGE_KEY)).toBe("false");
		expect(getStoredHeatmapEnabled()).toBe(false);

		localStorage.setItem(HEATMAP_STORAGE_KEY, "1");
		expect(getStoredHeatmapEnabled()).toBe(false);
	});
});
