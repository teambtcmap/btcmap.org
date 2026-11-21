import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { _, fallBackToEnglish, locale, localeLoaders } from "./index";

describe("locale loading", () => {
	beforeEach(async () => {
		vi.restoreAllMocks();
		vi.spyOn(console, "warn").mockImplementation(() => {});
		await locale.set("en");
	});

	it("falls back to English when the first locale fails to load", async () => {
		vi.spyOn(localeLoaders, "de").mockRejectedValueOnce(new Error("offline"));
		// As on the first load: no locale is set yet
		locale.set(null);

		await fallBackToEnglish(locale.set("de"));

		expect(get(locale)).toBe("en");
		expect(get(_)("mapControls.zoomIn")).toBe("Zoom in");
	});

	it("switches to English only once the English texts are in", async () => {
		// English loads along with the chosen locale, so it can still be on
		// its way when that one fails: hold it back here
		const english = await import("./locales/en.json");
		let finishEnglish: () => void = () => {};
		const loadEnglish = vi.spyOn(localeLoaders, "en").mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finishEnglish = () => resolve(english);
				}),
		);
		vi.spyOn(localeLoaders, "de").mockRejectedValueOnce(new Error("offline"));
		locale.set(null);

		const fallingBack = fallBackToEnglish(locale.set("de"));
		await vi.waitFor(() => expect(loadEnglish).toHaveBeenCalled());
		// No locale yet, rather than English with its texts missing
		expect(get(locale)).toBeFalsy();

		finishEnglish();
		await fallingBack;
		expect(get(locale)).toBe("en");
	});

	it("fetches a locale again on the next switch after it failed to load", async () => {
		const loadDutch = vi
			.spyOn(localeLoaders, "nl")
			.mockRejectedValueOnce(new Error("offline"));

		await expect(locale.set("nl")).rejects.toThrow("offline");
		// svelte-i18n keeps the locale it had
		expect(get(locale)).toBe("en");

		await locale.set("nl");

		expect(loadDutch).toHaveBeenCalledTimes(2);
		expect(get(locale)).toBe("nl");
		expect(get(_)("mapControls.zoomIn")).toBe("Inzoomen");
	});
});
