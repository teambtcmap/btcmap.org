import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#lib/analytics.js", () => ({ trackEvent: vi.fn() }));

import { trackEvent } from "#lib/analytics.js";
import type { AppConfig } from "#lib/apps.js";
import { trackAppClick, trackAppStoreClick } from "#lib/apps.js";

const app = (stores: AppConfig["stores"]): AppConfig => ({
	id: "wallet",
	name: "Wallet",
	logo: "/images/apps/wallet.png",
	tag: "powered-by-btcmap",
	sponsor: false,
	stores,
});

const playStore = {
	store: "google-play",
	platform: "android",
	url: "https://play.google.com/store/apps/details?id=wallet",
} as const;
const appStore = {
	store: "app-store",
	platform: "ios",
	url: "https://apps.apple.com/app/id1",
} as const;

describe("trackAppClick", () => {
	beforeEach(() => {
		vi.mocked(trackEvent).mockReset();
	});

	// #1678: a single-store app leaves for its store straight from the button
	it("counts a single-store app's press as the store click too", () => {
		trackAppClick(app([playStore]), "apps");

		expect(vi.mocked(trackEvent).mock.calls).toEqual([
			["app_click", { app: "wallet", source: "apps" }],
			[
				"app_store_click",
				{ app: "wallet", store: "google-play", source: "apps" },
			],
		]);
	});

	// The download modal's links report the store click for the others
	it("counts only the press for an app with several stores", () => {
		trackAppClick(app([playStore, appStore]), "home");

		expect(trackEvent).toHaveBeenCalledExactlyOnceWith("app_click", {
			app: "wallet",
			source: "home",
		});
	});
});

describe("trackAppStoreClick", () => {
	it("reports the app, the store and the page", () => {
		vi.mocked(trackEvent).mockReset();

		trackAppStoreClick(app([playStore, appStore]), "app-store", "home");

		expect(trackEvent).toHaveBeenCalledExactlyOnceWith("app_store_click", {
			app: "wallet",
			store: "app-store",
			source: "home",
		});
	});
});
