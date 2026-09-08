import { describe, expect, it } from "vitest";

import { renderBundledIcon } from "./renderBundledIcon";

describe("renderBundledIcon", () => {
	it("renders a bundled icon to a complete SVG at the requested color and size", () => {
		const svg = renderBundledIcon("ic:outline-restaurant", "white", 20);
		expect(svg).not.toBeNull();
		expect(svg).toMatch(/^<svg[^>]*>/);
		expect(svg).toContain('width="20"');
		expect(svg).toContain('height="20"');
		expect(svg).toContain("white");
		// The color swap is applied — no unresolved currentColor is left behind.
		expect(svg).not.toContain("currentColor");
	});

	it("applies an arbitrary color and size", () => {
		const svg = renderBundledIcon("ic:baseline-bookmark-added", "#0099AF", 10);
		expect(svg).toContain("#0099AF");
		expect(svg).toContain('width="10"');
		expect(svg).toContain('height="10"');
	});

	it("resolves the material-symbols fallback and the bitcoin fallback from the bundle", () => {
		// These back the map's fetchIconInnerSvg cascade, so they must be present.
		expect(
			renderBundledIcon("material-symbols:currency-bitcoin", "white", 20),
		).not.toBeNull();
	});

	it("returns null for an unknown prefix or icon so callers fall back to the API", () => {
		expect(renderBundledIcon("nosuchprefix:whatever", "white", 20)).toBeNull();
		expect(
			renderBundledIcon("ic:outline-definitely-not-an-icon", "white", 20),
		).toBeNull();
	});

	it("returns null for a name without a prefix", () => {
		expect(renderBundledIcon("restaurant", "white", 20)).toBeNull();
	});
});
