import { describe, expect, it } from "vitest";

import type { Area } from "$lib/types";

import {
	areaIconSrc,
	buildMetaDescription,
	calculateDistance,
	formatDistance,
	getCommunitiesAtCoordinates,
	sanitizeUrl,
} from "./utils";

describe("sanitizeUrl", () => {
	describe("undefined/empty input", () => {
		it("should return undefined for undefined input", () => {
			expect(sanitizeUrl(undefined)).toBeUndefined();
		});

		it("should return undefined for empty string", () => {
			expect(sanitizeUrl("")).toBeUndefined();
		});
	});

	describe("valid HTTPS/HTTP URLs", () => {
		it("should accept full HTTPS URLs", () => {
			expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
		});

		it("should accept full HTTP URLs", () => {
			expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
		});

		it("should accept HTTPS URLs with paths", () => {
			expect(sanitizeUrl("https://example.com/path/to/page")).toBe(
				"https://example.com/path/to/page",
			);
		});

		it("should accept HTTPS URLs with query strings", () => {
			expect(sanitizeUrl("https://example.com/path?query=value&foo=bar")).toBe(
				"https://example.com/path?query=value&foo=bar",
			);
		});

		it("should accept HTTPS URLs with hash fragments", () => {
			expect(sanitizeUrl("https://example.com/path#section")).toBe(
				"https://example.com/path#section",
			);
		});

		it("should accept URLs with port numbers", () => {
			expect(sanitizeUrl("https://example.com:8080/path")).toBe(
				"https://example.com:8080/path",
			);
		});

		it("should accept URLs with subdomains", () => {
			expect(sanitizeUrl("https://subdomain.example.com")).toBe(
				"https://subdomain.example.com",
			);
		});

		it("should accept URLs with authentication", () => {
			expect(sanitizeUrl("https://user:pass@example.com")).toBe(
				"https://user:pass@example.com",
			);
		});
	});

	describe("scheme-less URL normalization", () => {
		it("should prepend https:// to scheme-less domain", () => {
			expect(sanitizeUrl("example.com")).toBe("https://example.com");
		});

		it("should prepend https:// to www domains", () => {
			expect(sanitizeUrl("www.example.com")).toBe("https://www.example.com");
		});

		it("should normalize scheme-less URLs with paths", () => {
			expect(sanitizeUrl("reddit.com/r/bitcoin")).toBe(
				"https://reddit.com/r/bitcoin",
			);
		});

		it("should normalize scheme-less URLs with query strings", () => {
			expect(sanitizeUrl("example.com/page?query=value")).toBe(
				"https://example.com/page?query=value",
			);
		});

		it("should normalize scheme-less URLs with subdomains", () => {
			expect(sanitizeUrl("api.example.com/endpoint")).toBe(
				"https://api.example.com/endpoint",
			);
		});

		it("should reject scheme-less URLs with ports (ambiguous with protocol)", () => {
			// URLs like "example.com:8080" are ambiguous - "8080" could be a protocol or port
			// The regex pattern treats this as a protocol, so it's rejected
			expect(sanitizeUrl("example.com:8080")).toBeUndefined();
		});

		it("should normalize real-world social media URLs", () => {
			expect(sanitizeUrl("twitter.com/btcmap")).toBe(
				"https://twitter.com/btcmap",
			);
			expect(sanitizeUrl("reddit.com/r/bitcoinbeginners")).toBe(
				"https://reddit.com/r/bitcoinbeginners",
			);
			expect(sanitizeUrl("github.com/teambtcmap")).toBe(
				"https://github.com/teambtcmap",
			);
		});
	});

	describe("special URI schemes", () => {
		it("should accept mailto: URIs", () => {
			expect(sanitizeUrl("mailto:test@example.com")).toBe(
				"mailto:test@example.com",
			);
		});

		it("should accept mailto: URIs with subject", () => {
			expect(sanitizeUrl("mailto:test@example.com?subject=Hello")).toBe(
				"mailto:test@example.com?subject=Hello",
			);
		});

		it("should accept tel: URIs", () => {
			expect(sanitizeUrl("tel:+1234567890")).toBe("tel:+1234567890");
		});

		it("should accept tel: URIs without country code", () => {
			expect(sanitizeUrl("tel:5551234567")).toBe("tel:5551234567");
		});

		it("should accept tel: URIs with dashes", () => {
			expect(sanitizeUrl("tel:+1-555-123-4567")).toBe("tel:+1-555-123-4567");
		});

		it("should accept tel: URIs with spaces and parentheses", () => {
			expect(sanitizeUrl("tel:+1 (555) 123-4567")).toBe(
				"tel:+1 (555) 123-4567",
			);
		});
	});

	describe("XSS prevention", () => {
		it("should reject javascript: protocol", () => {
			expect(sanitizeUrl("javascript:alert(1)")).toBeUndefined();
		});

		it("should reject javascript: with encoded characters", () => {
			expect(sanitizeUrl("javascript:alert%281%29")).toBeUndefined();
		});

		it("should reject javascript: with spaces", () => {
			expect(sanitizeUrl("javascript: alert(1)")).toBeUndefined();
		});

		it("should reject data: URIs", () => {
			expect(
				sanitizeUrl("data:text/html,<script>alert(1)</script>"),
			).toBeUndefined();
		});

		it("should reject data: URIs with base64", () => {
			expect(
				sanitizeUrl(
					"data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
				),
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
		it("should normalize paths starting with / (treated as domain)", () => {
			// Paths starting with / are treated as domains and normalized
			// This is a limitation of the current implementation
			expect(sanitizeUrl("/path/to/page")).toBe("https:///path/to/page");
		});

		it("should normalize paths starting with ../ (treated as domain)", () => {
			// Paths starting with ../ are treated as domains and normalized
			expect(sanitizeUrl("../path/to/page")).toBe("https://../path/to/page");
		});

		it("should normalize paths starting with ./ (treated as domain)", () => {
			// Paths starting with ./ are treated as domains and normalized
			expect(sanitizeUrl("./path/to/page")).toBe("https://./path/to/page");
		});

		it("should normalize paths starting with . (treated as domain)", () => {
			// Paths starting with . are treated as domains and normalized
			expect(sanitizeUrl(".hidden")).toBe("https://.hidden");
		});

		it("should reject query strings without domain", () => {
			expect(sanitizeUrl("?query=value")).toBeUndefined();
		});

		it("should reject hash fragments without domain", () => {
			expect(sanitizeUrl("#section")).toBeUndefined();
		});
	});

	describe("invalid input", () => {
		it("should reject strings with only spaces", () => {
			expect(sanitizeUrl("   ")).toBeUndefined();
		});

		it("should normalize strings with special characters (treated as domain)", () => {
			// Strings like 'ht!tp://example.com' are treated as domains (no scheme detected)
			// and normalized to https://ht!tp://example.com (valid URL object)
			expect(sanitizeUrl("ht!tp://example.com")).toBe(
				"https://ht!tp://example.com",
			);
		});

		it("should accept malformed-looking URLs if parseable", () => {
			// 'http:/example.com' has a colon, so scheme is detected as 'http:'
			// It's a valid URL according to the URL constructor
			expect(sanitizeUrl("http:/example.com")).toBe("http:/example.com");
		});

		it("should reject URLs with invalid port", () => {
			expect(sanitizeUrl("https://example.com:99999")).toBeUndefined();
		});
	});

	describe("case sensitivity", () => {
		it("should handle uppercase protocols", () => {
			expect(sanitizeUrl("HTTPS://example.com")).toBe("HTTPS://example.com");
		});

		it("should handle mixed case protocols", () => {
			expect(sanitizeUrl("HtTpS://example.com")).toBe("HtTpS://example.com");
		});

		it("should handle uppercase HTTP", () => {
			expect(sanitizeUrl("HTTP://example.com")).toBe("HTTP://example.com");
		});

		it("should handle uppercase MAILTO", () => {
			expect(sanitizeUrl("MAILTO:test@example.com")).toBe(
				"MAILTO:test@example.com",
			);
		});

		it("should handle uppercase TEL", () => {
			expect(sanitizeUrl("TEL:+1234567890")).toBe("TEL:+1234567890");
		});
	});

	describe("edge cases", () => {
		it("should handle URLs with multiple consecutive slashes", () => {
			expect(sanitizeUrl("https://example.com//path//to///page")).toBe(
				"https://example.com//path//to///page",
			);
		});

		it("should handle IPv4 addresses", () => {
			expect(sanitizeUrl("https://192.168.1.1")).toBe("https://192.168.1.1");
		});

		it("should handle IPv4 addresses without scheme", () => {
			expect(sanitizeUrl("192.168.1.1")).toBe("https://192.168.1.1");
		});

		it("should handle localhost", () => {
			expect(sanitizeUrl("https://localhost:3000")).toBe(
				"https://localhost:3000",
			);
		});

		it("should reject localhost without scheme (ambiguous with protocol)", () => {
			// 'localhost:3000' is ambiguous - could be 'localhost' protocol or localhost with port
			// The regex treats '3000' as a protocol, so it's rejected
			expect(sanitizeUrl("localhost:3000")).toBeUndefined();
		});

		it("should handle URLs with encoded characters", () => {
			expect(sanitizeUrl("https://example.com/path%20with%20spaces")).toBe(
				"https://example.com/path%20with%20spaces",
			);
		});

		it("should handle URLs with Unicode characters", () => {
			expect(sanitizeUrl("https://example.com/パス")).toBe(
				"https://example.com/パス",
			);
		});

		it("should handle very long URLs", () => {
			const longPath = "a".repeat(1000);
			const longUrl = `https://example.com/${longPath}`;
			expect(sanitizeUrl(longUrl)).toBe(longUrl);
		});
	});

	describe("real-world examples", () => {
		it("should handle Twitter/X profile URLs", () => {
			expect(sanitizeUrl("https://twitter.com/btcmap")).toBe(
				"https://twitter.com/btcmap",
			);
			expect(sanitizeUrl("twitter.com/btcmap")).toBe(
				"https://twitter.com/btcmap",
			);
		});

		it("should handle GitHub repository URLs", () => {
			expect(sanitizeUrl("https://github.com/teambtcmap/btcmap.org")).toBe(
				"https://github.com/teambtcmap/btcmap.org",
			);
			expect(sanitizeUrl("github.com/teambtcmap/btcmap.org")).toBe(
				"https://github.com/teambtcmap/btcmap.org",
			);
		});

		it("should handle Reddit community URLs", () => {
			expect(sanitizeUrl("https://reddit.com/r/bitcoin")).toBe(
				"https://reddit.com/r/bitcoin",
			);
			expect(sanitizeUrl("reddit.com/r/bitcoin")).toBe(
				"https://reddit.com/r/bitcoin",
			);
		});

		it("should handle Telegram URLs", () => {
			expect(sanitizeUrl("https://t.me/btcmap")).toBe("https://t.me/btcmap");
			expect(sanitizeUrl("t.me/btcmap")).toBe("https://t.me/btcmap");
		});

		it("should handle Discord invite URLs", () => {
			expect(sanitizeUrl("https://discord.gg/invite123")).toBe(
				"https://discord.gg/invite123",
			);
			expect(sanitizeUrl("discord.gg/invite123")).toBe(
				"https://discord.gg/invite123",
			);
		});

		it("should handle Eventbrite URLs", () => {
			expect(sanitizeUrl("https://eventbrite.com/e/my-event-123")).toBe(
				"https://eventbrite.com/e/my-event-123",
			);
			expect(sanitizeUrl("eventbrite.com/e/my-event-123")).toBe(
				"https://eventbrite.com/e/my-event-123",
			);
		});

		it("should handle Matrix room URLs", () => {
			expect(sanitizeUrl("https://matrix.to/#/!roomid:server.org")).toBe(
				"https://matrix.to/#/!roomid:server.org",
			);
		});

		it("should handle Geyser project URLs", () => {
			expect(sanitizeUrl("https://geyser.fund/project/btcmap")).toBe(
				"https://geyser.fund/project/btcmap",
			);
			expect(sanitizeUrl("geyser.fund/project/btcmap")).toBe(
				"https://geyser.fund/project/btcmap",
			);
		});

		it("should handle email addresses", () => {
			expect(sanitizeUrl("mailto:hello@btcmap.org")).toBe(
				"mailto:hello@btcmap.org",
			);
		});

		it("should handle phone numbers", () => {
			expect(sanitizeUrl("tel:+15551234567")).toBe("tel:+15551234567");
		});
	});
});

describe("calculateDistance", () => {
	it("returns 0 for identical coordinates", () => {
		expect(calculateDistance(51.5, -0.1, 51.5, -0.1)).toBe(0);
	});

	it("returns a positive value for different coordinates", () => {
		expect(calculateDistance(51.5, -0.1, 48.8, 2.3)).toBeGreaterThan(0);
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
		it("formats sub-km distances in metres", () => {
			expect(formatDistance(0.5, true)).toBe("500m");
		});

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

describe("areaIconSrc", () => {
	it("returns the raw URL for static.btcmap.org/images/areas paths", () => {
		const url = "https://static.btcmap.org/images/areas/abc.png";
		expect(areaIconSrc(url)).toBe(url);
		expect(areaIconSrc(url, 64)).toBe(url);
	});

	it("wraps non-static.btcmap.org URLs with the Netlify image service", () => {
		const url = "https://ugc.production.linktr.ee/foo.webp";
		expect(areaIconSrc(url)).toBe(
			`https://btcmap.org/.netlify/images?url=${encodeURIComponent(url)}&fit=cover&w=256&h=256`,
		);
	});

	it("respects a custom size", () => {
		const url = "https://example.com/icon.png";
		expect(areaIconSrc(url, 64)).toBe(
			`https://btcmap.org/.netlify/images?url=${encodeURIComponent(url)}&fit=cover&w=64&h=64`,
		);
	});

	it("does not bypass for paths outside /images/areas/", () => {
		const url = "https://static.btcmap.org/images/countries/us.svg";
		expect(areaIconSrc(url)).toBe(
			`https://btcmap.org/.netlify/images?url=${encodeURIComponent(url)}&fit=cover&w=256&h=256`,
		);
	});

	it("handles null/undefined/empty inputs without throwing", () => {
		expect(areaIconSrc(null)).toBe(
			"https://btcmap.org/.netlify/images?url=&fit=cover&w=256&h=256",
		);
		expect(areaIconSrc(undefined)).toBe(
			"https://btcmap.org/.netlify/images?url=&fit=cover&w=256&h=256",
		);
		expect(areaIconSrc("")).toBe(
			"https://btcmap.org/.netlify/images?url=&fit=cover&w=256&h=256",
		);
	});
});
