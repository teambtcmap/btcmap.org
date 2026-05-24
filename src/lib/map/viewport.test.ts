import { describe, expect, it } from "vitest";

import { getZoomBehavior } from "./viewport";

describe("getZoomBehavior", () => {
	it('returns "none" for zoom levels below 11', () => {
		expect(getZoomBehavior(1)).toBe("none");
		expect(getZoomBehavior(5)).toBe("none");
		expect(getZoomBehavior(10)).toBe("none");
	});

	it('returns "api-with-limit" for zoom levels 11-14', () => {
		expect(getZoomBehavior(11)).toBe("api-with-limit");
		expect(getZoomBehavior(12)).toBe("api-with-limit");
		expect(getZoomBehavior(14)).toBe("api-with-limit");
	});

	it('returns "local-markers" for zoom levels 15+', () => {
		expect(getZoomBehavior(15)).toBe("local-markers");
		expect(getZoomBehavior(16)).toBe("local-markers");
		expect(getZoomBehavior(17)).toBe("local-markers");
		expect(getZoomBehavior(18)).toBe("local-markers");
		expect(getZoomBehavior(20)).toBe("local-markers");
	});
});
