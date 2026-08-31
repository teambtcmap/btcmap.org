import { describe, expect, it } from "vitest";

import type { Place } from "$lib/types";

import {
	buildCompositeSvg,
	PIN_FILL_BOOSTED,
	PIN_FILL_REGULAR,
	PIN_FILLS,
	pinVariantFor,
	resolveIconifyName,
	spriteName,
} from "./maplibreSprites";

const place = (overrides: Partial<Place> = {}): Place =>
	({ id: 1, lat: 0, lon: 0, icon: "cafe", ...overrides }) as Place;

const future = () => new Date(Date.now() + 86_400_000).toISOString();
const recent = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

describe("pinVariantFor", () => {
	it("keeps the boost vocabulary outside issues mode", () => {
		expect(pinVariantFor(place({ verified_at: "2000-01-01" }), null)).toBe("r");
		expect(pinVariantFor(place({ boosted_until: future() }), null)).toBe("b");
	});

	it("colors by the dominant issue in issues mode, replacing boost", () => {
		const all = new Set([
			"outdated",
			"outdated_soon",
			"not_verified",
			"missing_icon",
		] as const);
		expect(
			pinVariantFor(
				place({ verified_at: "2000-01-01", boosted_until: future() }),
				all,
			),
		).toBe("od");
		expect(pinVariantFor(place({ verified_at: undefined }), all)).toBe("nv");
		expect(
			pinVariantFor(place({ verified_at: recent(), icon: undefined }), all),
		).toBe("mi");
	});

	it("colors by the dominant SELECTED issue when chips narrow the view", () => {
		// outdated + missing_icon place, but only missing_icon is selected —
		// the hue must explain membership in the filtered worklist.
		const onlyMissingIcon = new Set(["missing_icon"] as const);
		expect(
			pinVariantFor(
				place({ verified_at: "2000-01-01", icon: undefined }),
				onlyMissingIcon,
			),
		).toBe("mi");
	});

	it("falls back to boost colors for a clean place in issues mode", () => {
		// Search-exempted places render without issues even in the worklist.
		const all = new Set(["outdated"] as const);
		expect(pinVariantFor(place({ verified_at: recent() }), all)).toBe("r");
	});
});

describe("sprite naming and fills", () => {
	it("bakes the variant into the sprite name", () => {
		expect(spriteName("cafe", "r")).toBe("pin-r-cafe");
		expect(spriteName("cafe", "od")).toBe("pin-od-cafe");
	});

	it("keeps the legacy fills stable and gives issue variants distinct hues", () => {
		expect(PIN_FILLS.r).toBe(PIN_FILL_REGULAR);
		expect(PIN_FILLS.b).toBe(PIN_FILL_BOOSTED);
		expect(new Set(Object.values(PIN_FILLS)).size).toBe(
			Object.keys(PIN_FILLS).length,
		);
	});

	it("renders the variant fill into the composite svg", () => {
		const svg = buildCompositeSvg("<svg></svg>", "nv");
		expect(svg).toContain(`fill="${PIN_FILLS.nv}"`);
	});
});

describe("resolveIconifyName", () => {
	it("substitutes the Bitcoin glyph for the untagged placeholder", () => {
		expect(resolveIconifyName("question_mark")).toBe(
			"material-symbols:currency-bitcoin",
		);
	});

	it("uses the default ic:outline form for ids that exist there", () => {
		expect(resolveIconifyName("local_cafe")).toBe("ic:outline-local-cafe");
		expect(resolveIconifyName("18_up_rating")).toBe("ic:outline-18-up-rating");
	});

	// These ids have no ic:outline counterpart, so without a table entry they
	// resolve to a 404 name. The sprite pipeline papers over that with its
	// material-symbols retry, but Icon.svelte has no fallback and renders
	// nothing at all — a blank icon in the list, drawer and area cards.
	it.each(["destruction", "dresser", "adult_content"])(
		"keeps %s off the broken ic:outline path",
		(icon) => {
			expect(resolveIconifyName(icon)).toMatch(/^material-symbols:/);
		},
	);
});
