import { toast } from "svelte-sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MERCHANT_LIST_MAX_ITEMS } from "#lib/constants.js";
import type { Area } from "#lib/types.js";

import {
	areaIconSrc,
	buildMetaDescription,
	calculateDistance,
	formatDistance,
	formatNearbyPillCount,
	formatVerifiedHuman,
	getCommunitiesAtCoordinates,
	getGrade,
	isValidLatitude,
	isValidLightningTip,
	isValidLongitude,
	lightningAddress,
	sanitizeUrl,
	stripLightningScheme,
	successToast,
} from "./utils";

vi.mock("svelte-sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe("sanitizeUrl", () => {
	describe("undefined/empty input", () => {
		it("should return undefined for undefined input", () => {
			expect(sanitizeUrl(undefined)).toBeUndefined();
		});
	});

	describe("valid HTTPS/HTTP URLs", () => {
		it("should accept full HTTPS URLs", () => {
			expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
		});

		it("should accept full HTTP URLs", () => {
			expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
		});
	});

	describe("scheme-less URL normalization", () => {
		it("should prepend https:// to scheme-less domain", () => {
			expect(sanitizeUrl("example.com")).toBe("https://example.com");
		});

		it("should reject scheme-less URLs with ports (ambiguous with protocol)", () => {
			// URLs like "example.com:8080" are ambiguous - "8080" could be a protocol or port
			// The regex pattern treats this as a protocol, so it's rejected
			expect(sanitizeUrl("example.com:8080")).toBeUndefined();
		});
	});

	describe("special URI schemes", () => {
		it("should accept mailto: URIs", () => {
			expect(sanitizeUrl("mailto:test@example.com")).toBe(
				"mailto:test@example.com",
			);
		});

		it("should accept tel: URIs", () => {
			expect(sanitizeUrl("tel:+1234567890")).toBe("tel:+1234567890");
		});
	});

	describe("XSS prevention", () => {
		it("should reject javascript: protocol", () => {
			expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
		});

		it("should reject data: URIs", () => {
			expect(
				sanitizeUrl("data:text/html,<script>alert(1)</script>"),
			).toBeUndefined();
		});

		it("should reject vbscript: protocol", () => {
			expect(sanitizeUrl("vbscript:msgbox(1)")).toBeUndefined();
		});

		it("should reject file: protocol", () => {
			expect(sanitizeUrl("file:///etc/passwd")).toBeUndefined();
		});

		it("should reject ftp: protocol", () => {
			expect(sanitizeUrl("ftp://example.com/file.txt")).toBeUndefined();
		});
	});

	describe("relative URL rejection", () => {
		it("should reject query strings without domain", () => {
			expect(sanitizeUrl("?query=value")).toBeUndefined();
		});
	});

	describe("invalid input", () => {
		it("should reject URLs with invalid port", () => {
			expect(sanitizeUrl("https://example.com:99999")).toBeUndefined();
		});
	});

	describe("case sensitivity", () => {
		it("should handle uppercase protocols", () => {
			expect(sanitizeUrl("HTTPS://example.com")).toBe("HTTPS://example.com");
		});
	});
});

describe("formatNearbyPillCount", () => {
	it("returns empty string for zero or negative counts", () => {
		expect(formatNearbyPillCount(0)).toBe("");
		expect(formatNearbyPillCount(-1)).toBe("");
	});

	it("returns plain number within limit", () => {
		expect(formatNearbyPillCount(1)).toBe("1");
		expect(formatNearbyPillCount(MERCHANT_LIST_MAX_ITEMS)).toBe(
			String(MERCHANT_LIST_MAX_ITEMS),
		);
	});

	it("caps with a > prefix above the list limit", () => {
		expect(formatNearbyPillCount(MERCHANT_LIST_MAX_ITEMS + 1)).toBe(
			`>${MERCHANT_LIST_MAX_ITEMS}`,
		);
	});
});

describe("calculateDistance", () => {
	it("returns 0 for identical coordinates", () => {
		expect(calculateDistance(51.5, -0.1, 51.5, -0.1)).toBe(0);
	});

	it("returns distance in km (London to Paris ≈ 340km)", () => {
		const dist = calculateDistance(51.5074, -0.1278, 48.8566, 2.3522);
		expect(dist).toBeGreaterThan(330);
		expect(dist).toBeLessThan(350);
	});

	it("is symmetric", () => {
		const ab = calculateDistance(51.5, -0.1, 48.8, 2.3);
		const ba = calculateDistance(48.8, 2.3, 51.5, -0.1);
		expect(ab).toBeCloseTo(ba, 5);
	});
});

describe("formatDistance", () => {
	describe("metric", () => {
		it("rounds metres correctly", () => {
			expect(formatDistance(0.1234, true)).toBe("123m");
		});

		it("formats distances under 10km with one decimal", () => {
			expect(formatDistance(3.456, true)).toBe("3.5km");
		});

		it("formats distances 10km and over as whole km", () => {
			expect(formatDistance(12.7, true)).toBe("13km");
		});
	});

	describe("imperial", () => {
		it("formats short distances in feet", () => {
			// 0.05km ≈ 164ft, well under 0.1mi threshold
			expect(formatDistance(0.05, false)).toBe("164ft");
		});

		it("formats distances under 10mi with one decimal", () => {
			// 5km ≈ 3.1mi
			expect(formatDistance(5, false)).toBe("3.1mi");
		});

		it("formats distances 10mi and over as whole miles", () => {
			// 20km ≈ 12.4mi
			expect(formatDistance(20, false)).toBe("12mi");
		});
	});
});

describe("getCommunitiesAtCoordinates", () => {
	// Box polygon around Warsaw (lat 52.0-53.0, lon 20.0-22.0)
	const warsawBox = {
		type: "Polygon" as const,
		coordinates: [
			[
				[20, 52],
				[22, 52],
				[22, 53],
				[20, 53],
				[20, 52],
			],
		],
	};

	// Box polygon far away (Atlantic ocean)
	const atlanticBox = {
		type: "Polygon" as const,
		coordinates: [
			[
				[-40, 30],
				[-20, 30],
				[-20, 40],
				[-40, 40],
				[-40, 30],
			],
		],
	};

	const makeArea = (
		overrides: Partial<Area["tags"]> & { id?: string },
	): Area => ({
		id: overrides.id ?? "test-area",
		tags: {
			type: "community",
			name: "Test",
			continent: "europe",
			url_alias: "test",
			geo_json: warsawBox,
			"icon:square": "https://example.com/icon.png",
			...overrides,
		} as Area["tags"],
		created_at: "",
		updated_at: "",
		deleted_at: "",
	});

	it("returns empty array when no areas provided", () => {
		expect(getCommunitiesAtCoordinates(52.23, 21.01, [])).toEqual([]);
	});

	it("returns community whose polygon contains the point", () => {
		const warsaw = makeArea({ id: "warsaw", name: "Warsaw" });
		const result = getCommunitiesAtCoordinates(52.23, 21.01, [warsaw]);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("warsaw");
	});

	it("excludes communities whose polygon does not contain the point", () => {
		const atlantic = makeArea({ id: "atl", geo_json: atlanticBox });
		expect(getCommunitiesAtCoordinates(52.23, 21.01, [atlantic])).toEqual([]);
	});

	it("excludes countries even if their polygon contains the point", () => {
		const poland = makeArea({ id: "poland", type: "country" });
		expect(getCommunitiesAtCoordinates(52.23, 21.01, [poland])).toEqual([]);
	});

	it("skips areas without geo_json without throwing", () => {
		const noGeo = makeArea({
			id: "no-geo",
			geo_json: undefined as unknown as Area["tags"]["geo_json"],
		});
		expect(getCommunitiesAtCoordinates(52.23, 21.01, [noGeo])).toEqual([]);
	});

	it("returns multiple matching communities when both contain the point", () => {
		const a = makeArea({ id: "a" });
		const b = makeArea({ id: "b" });
		const result = getCommunitiesAtCoordinates(52.23, 21.01, [a, b]);
		expect(result.map((c) => c.id).sort()).toEqual(["a", "b"]);
	});

	it("handles antimeridian-wrapping polygons (e.g. Fiji)", () => {
		// Polygon that straddles ±180°: covers lon 175°E → 180° → -175°W, lat 15°S → 20°S
		const fijiBox = {
			type: "Polygon" as const,
			coordinates: [
				[
					[175, -20],
					[185, -20], // 185 longitude normalized to -175
					[185, -15],
					[175, -15],
					[175, -20],
				],
			],
		};
		const fiji = makeArea({ id: "fiji", geo_json: fijiBox });
		// Point at lon 178 (clearly inside the wrapped range)
		const inside = getCommunitiesAtCoordinates(-17, 178, [fiji]);
		expect(inside.map((c) => c.id)).toEqual(["fiji"]);
		// Point at lon 0 (clearly outside) should still be rejected
		const outside = getCommunitiesAtCoordinates(-17, 0, [fiji]);
		expect(outside).toEqual([]);
	});
});

describe("buildMetaDescription", () => {
	const fallback = "Fallback description for {name}.";

	it("uses description when present and short enough", () => {
		expect(buildMetaDescription("A short bio.", fallback, 200)).toBe(
			"A short bio.",
		);
	});

	it("falls back when description is nullish or empty", () => {
		expect(buildMetaDescription(null, fallback, 200)).toBe(fallback);
		expect(buildMetaDescription(undefined, fallback, 200)).toBe(fallback);
		expect(buildMetaDescription("", fallback, 200)).toBe(fallback);
		expect(buildMetaDescription("   ", fallback, 200)).toBe(fallback);
	});

	it("collapses internal whitespace and trims", () => {
		expect(buildMetaDescription("  foo\n\tbar   baz  ", fallback, 200)).toBe(
			"foo bar baz",
		);
	});

	it("truncates long descriptions at a word boundary with an ellipsis", () => {
		const long = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
		// max=20 → cut at 19 codepoints ("alpha beta gamma de"),
		// then back off to the last word boundary inside that slice.
		expect(buildMetaDescription(long, fallback, 20)).toBe("alpha beta gamma…");
	});

	it("does not split surrogate pairs when truncating near an emoji", () => {
		// Each 🍊 is two UTF-16 code units but one code point.
		const emojiHeavy = `${"ab ".repeat(6)}🍊🍊🍊🍊🍊🍊🍊🍊🍊🍊`;
		const out = buildMetaDescription(emojiHeavy, fallback, 20);
		// If a surrogate pair was split, the resulting string would
		// contain an unpaired surrogate (U+D800-U+DFFF).
		expect(out).not.toMatch(/[\uD800-\uDFFF](?![\uDC00-\uDFFF])/);
		expect(out).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
	});

	it("falls back to a hard cut when no word boundary is in the last 30%", () => {
		// Single very long token with no spaces.
		const out = buildMetaDescription("a".repeat(500), fallback, 20);
		expect(out).toBe(`${"a".repeat(19)}…`);
	});
});

describe("isValidLatitude", () => {
	it("accepts values within [-90, 90]", () => {
		expect(isValidLatitude(0)).toBe(true);
		expect(isValidLatitude(52.52)).toBe(true);
		expect(isValidLatitude(-33.8688)).toBe(true);
		expect(isValidLatitude(90)).toBe(true);
		expect(isValidLatitude(-90)).toBe(true);
	});

	it("rejects values outside [-90, 90]", () => {
		expect(isValidLatitude(90.0001)).toBe(false);
		expect(isValidLatitude(-90.0001)).toBe(false);
		expect(isValidLatitude(180)).toBe(false);
	});

	it("rejects non-finite values", () => {
		expect(isValidLatitude(Number.NaN)).toBe(false);
		expect(isValidLatitude(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isValidLatitude(Number.NEGATIVE_INFINITY)).toBe(false);
	});
});

describe("isValidLongitude", () => {
	it("accepts values within [-180, 180]", () => {
		expect(isValidLongitude(0)).toBe(true);
		expect(isValidLongitude(13.405)).toBe(true);
		expect(isValidLongitude(-122.4194)).toBe(true);
		expect(isValidLongitude(180)).toBe(true);
		expect(isValidLongitude(-180)).toBe(true);
	});

	it("rejects values outside [-180, 180]", () => {
		expect(isValidLongitude(180.0001)).toBe(false);
		expect(isValidLongitude(-180.0001)).toBe(false);
		expect(isValidLongitude(200)).toBe(false);
	});

	it("rejects non-finite values", () => {
		expect(isValidLongitude(Number.NaN)).toBe(false);
		expect(isValidLongitude(Number.POSITIVE_INFINITY)).toBe(false);
		expect(isValidLongitude(Number.NEGATIVE_INFINITY)).toBe(false);
	});
});

describe("areaIconSrc", () => {
	// A truthy icon value signals the area has an image; the URL itself is no
	// longer used to build the src — the area id keys the v4 image endpoint.
	const icon = "https://static.btcmap.org/images/areas/361.png";

	it("builds the v4 area image endpoint URL from the area id", () => {
		expect(areaIconSrc("free-madeira", icon)).toBe(
			"https://api.btcmap.org/v4/areas/free-madeira/image?type=square&w=256&h=256",
		);
	});

	it("respects a custom size", () => {
		expect(areaIconSrc("free-madeira", icon, 64)).toBe(
			"https://api.btcmap.org/v4/areas/free-madeira/image?type=square&w=64&h=64",
		);
	});

	it("treats a numeric id of 0 as valid, not missing", () => {
		expect(areaIconSrc(0, icon)).toBe(
			"https://api.btcmap.org/v4/areas/0/image?type=square&w=256&h=256",
		);
	});

	it("url-encodes the id", () => {
		expect(areaIconSrc("a b/c", icon)).toBe(
			"https://api.btcmap.org/v4/areas/a%20b%2Fc/image?type=square&w=256&h=256",
		);
	});

	it("returns the bitcoin fallback when the area has no icon", () => {
		expect(areaIconSrc("free-madeira", null)).toBe("/images/bitcoin.svg");
		expect(areaIconSrc("free-madeira", undefined)).toBe("/images/bitcoin.svg");
		expect(areaIconSrc("free-madeira", "")).toBe("/images/bitcoin.svg");
	});

	it("returns the bitcoin fallback when the id is missing", () => {
		expect(areaIconSrc(null, icon)).toBe("/images/bitcoin.svg");
		expect(areaIconSrc(undefined, icon)).toBe("/images/bitcoin.svg");
		expect(areaIconSrc("", icon)).toBe("/images/bitcoin.svg");
	});
});

describe("stripLightningScheme", () => {
	it("removes a leading lightning: scheme", () => {
		expect(stripLightningScheme("lightning:alice@getalby.com")).toBe(
			"alice@getalby.com",
		);
	});

	it("leaves a bare address untouched", () => {
		expect(stripLightningScheme("alice@getalby.com")).toBe("alice@getalby.com");
	});

	it("strips the scheme case-insensitively", () => {
		expect(stripLightningScheme("LIGHTNING:alice@getalby.com")).toBe(
			"alice@getalby.com",
		);
	});

	it("trims surrounding whitespace", () => {
		expect(stripLightningScheme("  lightning:alice@getalby.com  ")).toBe(
			"alice@getalby.com",
		);
	});

	it("strips whitespace following the scheme", () => {
		expect(stripLightningScheme("lightning: alice@getalby.com")).toBe(
			"alice@getalby.com",
		);
	});
});

describe("isValidLightningTip", () => {
	it("accepts a well-formed lightning address", () => {
		expect(isValidLightningTip("alice@getalby.com")).toBe(true);
	});

	it("accepts an address that still carries the lightning: scheme", () => {
		expect(isValidLightningTip("lightning:alice@getalby.com")).toBe(true);
	});

	it("accepts an address with whitespace after the scheme", () => {
		expect(isValidLightningTip("lightning: alice@getalby.com")).toBe(true);
	});

	it("rejects undefined/empty input", () => {
		expect(isValidLightningTip(undefined)).toBe(false);
		expect(isValidLightningTip("")).toBe(false);
	});

	it("rejects an undefined username leaked from missing data", () => {
		expect(isValidLightningTip("undefined@zbd.gg")).toBe(false);
		expect(isValidLightningTip("lightning:undefined@zbd.gg")).toBe(false);
	});

	it("rejects a null username", () => {
		expect(isValidLightningTip("null@zbd.gg")).toBe(false);
	});

	it("rejects an address with no domain dot", () => {
		expect(isValidLightningTip("alice@localhost")).toBe(false);
	});

	it("rejects an address containing whitespace", () => {
		expect(isValidLightningTip("alice @getalby.com")).toBe(false);
	});
});

describe("lightningAddress", () => {
	it.each([
		["Hi [⚡](lightning:sats@example.com)", "sats@example.com"],
		["Tips: lightning:sats@example.com", "sats@example.com"],
		["[⚡](lightning:)", null],
		["No tips here", null],
	])("finds the address in %j: %j", (description, expected) => {
		expect(lightningAddress(description)).toBe(expected);
	});
});

describe("getGrade", () => {
	// The star rating in the area map header renders directly from these
	// boundaries (5 stars must mean >=95% up to date) — pin every edge.
	it("maps the documented percentage boundaries to grades", () => {
		expect(getGrade(100)).toBe(5);
		expect(getGrade(95)).toBe(5);
		expect(getGrade(94)).toBe(4);
		expect(getGrade(75)).toBe(4);
		expect(getGrade(74)).toBe(3);
		expect(getGrade(50)).toBe(3);
		expect(getGrade(49)).toBe(2);
		expect(getGrade(25)).toBe(2);
		expect(getGrade(24)).toBe(1);
		expect(getGrade(0)).toBe(1);
	});
});

describe("successToast", () => {
	it("shows a plain success toast", () => {
		successToast("Saved");
		expect(toast.success).toHaveBeenCalledWith("Saved", undefined);
	});

	it("adds an action button and keeps the toast up longer", () => {
		const onClick = () => {};
		successToast("Uploaded", { label: "Undo", onClick });
		expect(toast.success).toHaveBeenCalledWith("Uploaded", {
			action: { label: "Undo", onClick },
			duration: 8000,
		});
	});
});

describe("formatVerifiedHuman", () => {
	// Wednesday 7 October 2026 at noon, local time
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const at = (year: number, month: number, day: number, hour = 0, minute = 0) =>
		new Date(year, month, day, hour, minute).toISOString();
	const daysAgo = (days: number) => at(2026, 9, 7 - days, 9);

	it("returns an empty string without a date and the input for an invalid one", () => {
		expect(formatVerifiedHuman(undefined)).toBe("");
		expect(formatVerifiedHuman("")).toBe("");
		expect(formatVerifiedHuman("not a date", "de")).toBe("not a date");
	});

	it("keeps the English wording when no locale is given", () => {
		expect(formatVerifiedHuman(at(2026, 9, 7, 8))).toBe("Today");
		expect(formatVerifiedHuman(daysAgo(1))).toBe("1 day ago");
		expect(formatVerifiedHuman(daysAgo(3))).toBe("3 days ago");
		expect(formatVerifiedHuman(at(2026, 5, 15))).toBe("15 June");
		expect(formatVerifiedHuman(at(2025, 4, 25))).toBe("25 May 2025");
	});

	it.each([
		["de", "Heute", "vor 1 Tag", "vor 3 Tagen", "15. Juni", "25. Mai 2025"],
	])(
		"words %s dates in that language",
		(locale, today, yesterday, recent, thisYear, otherYear) => {
			expect(formatVerifiedHuman(at(2026, 9, 7, 8), locale)).toBe(today);
			expect(formatVerifiedHuman(daysAgo(1), locale)).toBe(yesterday);
			expect(formatVerifiedHuman(daysAgo(3), locale)).toBe(recent);
			expect(formatVerifiedHuman(at(2026, 5, 15), locale)).toBe(thisYear);
			expect(formatVerifiedHuman(at(2025, 4, 25), locale)).toBe(otherYear);
		},
	);

	it("counts calendar days, not 24-hour periods", () => {
		// Verified late the evening before: one calendar day, not "2 hours"
		vi.setSystemTime(new Date(2026, 9, 7, 0, 30, 0));
		expect(formatVerifiedHuman(at(2026, 9, 6, 22, 30), "de")).toBe("vor 1 Tag");
		expect(formatVerifiedHuman(at(2026, 9, 6, 23, 50))).toBe("1 day ago");

		// Three calendar days back at 23:00, viewed at 08:00: 2.4 days of
		// elapsed time, but three days on the calendar
		vi.setSystemTime(new Date(2026, 9, 7, 8, 0, 0));
		expect(formatVerifiedHuman(at(2026, 9, 4, 23, 0), "de")).toBe(
			"vor 3 Tagen",
		);
	});

	it("switches from a distance to a calendar date after 30 days", () => {
		expect(formatVerifiedHuman(daysAgo(29), "de")).toBe("vor 29 Tagen");
		expect(formatVerifiedHuman(daysAgo(31), "de")).toBe("6. September");
	});

	it("falls back to English for a locale Intl does not know", () => {
		expect(formatVerifiedHuman(daysAgo(3), "xx-invalid-locale!")).toBe(
			"3 days ago",
		);
		expect(formatVerifiedHuman(at(2026, 5, 15), "xx")).toBe("15 June");
	});
});
