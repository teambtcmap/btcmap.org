import { describe, expect, it } from "vitest";

import { deriveNearbyListStatus } from "./nearbyListStatus";
import { getZoomBehavior } from "./viewport";

describe("deriveNearbyListStatus", () => {
	it("returns 'loading' whenever a list fetch is in flight, regardless of residue", () => {
		// Loading wins over below-floor and over the too-dense residue: the
		// panel's spinner takes precedence so a stale count-only state can't
		// flash the zoom-in link (pins the old !isLoadingList guards).
		expect(
			deriveNearbyListStatus({
				behavior: "none",
				isLoading: true,
				hasError: false,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("loading");
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: true,
				hasError: false,
				merchantCount: 0,
				totalCount: 800,
			}),
		).toBe("loading");
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: true,
				hasError: false,
				merchantCount: 12,
				totalCount: 12,
			}),
		).toBe("loading");
	});

	it("returns 'below-floor' for behavior 'none' no matter what data lingers", () => {
		// Stale merchants can linger during the moveend debounce after zooming
		// out across the floor — the prompt must still show immediately.
		expect(
			deriveNearbyListStatus({
				behavior: "none",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("below-floor");
		expect(
			deriveNearbyListStatus({
				behavior: "none",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 42,
			}),
		).toBe("below-floor");
		expect(
			deriveNearbyListStatus({
				behavior: "none",
				isLoading: false,
				hasError: false,
				merchantCount: 3,
				totalCount: 5,
			}),
		).toBe("below-floor");
	});

	it("maps the blanked-list residue (no rows, nonzero total) to 'too-dense'", () => {
		// fetchAndReplaceList's hideIfExceeds branch and fetchCountOnly both
		// encode "hidden" as merchants=[] with totalCount kept.
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 800,
			}),
		).toBe("too-dense");
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 40,
			}),
		).toBe("too-dense");
	});

	it("never returns 'below-floor' when the boosts/issues override forces local-markers", () => {
		// ?boosts=true / ?issues pin behavior to 'local-markers' at ANY zoom:
		// a populated list renders, an empty one falls through to 'empty' —
		// not to the zoom-in prompt (#1171 re-review constraint).
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: false,
				hasError: false,
				merchantCount: 7,
				totalCount: 7,
			}),
		).toBe("ok");
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("empty");
	});

	it("returns 'empty' when nothing is nearby", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: false,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("empty");
	});

	it("returns 'truncated' when the list shows fewer rows than exist", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: false,
				hasError: false,
				merchantCount: 250,
				totalCount: 400,
			}),
		).toBe("truncated");
	});

	it("returns 'ok' when every match is listed", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: false,
				merchantCount: 25,
				totalCount: 25,
			}),
		).toBe("ok");
	});

	it("keeps the zoom-10 floor boundary exactly where getZoomBehavior puts it", () => {
		// behavior === "none" ⇔ zoom < MERCHANT_LIST_LOW_ZOOM: composing with
		// getZoomBehavior pins the boundary the panel used to check directly.
		const at = (zoom: number) =>
			deriveNearbyListStatus({
				behavior: getZoomBehavior(zoom),
				isLoading: false,
				hasError: false,
				merchantCount: 3,
				totalCount: 3,
			});
		expect(at(9.99)).toBe("below-floor");
		expect(at(10)).toBe("ok");
	});

	it("returns 'error' when the last fetch failed and nothing is renderable", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: true,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("error");
		// A stale too-dense claim must not outrank a known failure.
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: true,
				merchantCount: 0,
				totalCount: 800,
			}),
		).toBe("error");
	});

	it("keeps stale rows visible after a failed refresh", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: false,
				hasError: true,
				merchantCount: 25,
				totalCount: 25,
			}),
		).toBe("ok");
		expect(
			deriveNearbyListStatus({
				behavior: "local-markers",
				isLoading: false,
				hasError: true,
				merchantCount: 250,
				totalCount: 400,
			}),
		).toBe("truncated");
	});

	it("loading and below-floor take precedence over error", () => {
		expect(
			deriveNearbyListStatus({
				behavior: "api-with-limit",
				isLoading: true,
				hasError: true,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("loading");
		// The local/none paths clear the flag via setMerchants, but pin the
		// precedence anyway.
		expect(
			deriveNearbyListStatus({
				behavior: "none",
				isLoading: false,
				hasError: true,
				merchantCount: 0,
				totalCount: 0,
			}),
		).toBe("below-floor");
	});
});
