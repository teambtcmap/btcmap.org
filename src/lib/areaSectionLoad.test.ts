import { isHttpError, isRedirect } from "@sveltejs/kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AreaSectionConfig } from "./areaSectionLoad";
import { loadAreaSection } from "./areaSectionLoad";

type ResponseOverrides = {
	ok?: boolean;
	status?: number;
	json?: () => unknown;
};

type FetchResponses = {
	areas?: ResponseOverrides;
	issues?: ResponseOverrides;
};

const AREA_OK = {
	id: 42,
	deleted_at: null,
	tags: {
		type: "community",
		url_alias: "some-area",
		name: "Some Area",
		description: "An area description",
		continent: "europe",
		geo_json: { type: "Polygon", coordinates: [] },
		"verified:date": "2024-01-01",
		"icon:square": "https://example.com/icon.png",
	},
};

const ISSUES_OK = { requested_issues: [{ id: 1 }, { id: 2 }] };

const buildResponse = (overrides: ResponseOverrides) =>
	({
		ok: overrides.ok ?? true,
		status: overrides.status ?? 200,
		json: overrides.json ?? (() => ({})),
	}) as unknown as Response;

const makeFetch = (responses: FetchResponses = {}) =>
	vi.fn(async (url: string | URL) => {
		const href = url.toString();
		if (href.includes("/v3/areas/")) {
			return buildResponse({ json: () => AREA_OK, ...responses.areas });
		}
		if (href.includes("/v4/place-issues")) {
			return buildResponse({ json: () => ISSUES_OK, ...responses.issues });
		}
		throw new Error(`unexpected fetch URL: ${href}`);
	});

const communityConfig: AreaSectionConfig = {
	notFoundMessage: "Community Not Found",
	redirectBase: "/community",
	isValidArea: (area) => !area.includes("/"),
	hasRequiredTags: () => true,
};

const countryConfig: AreaSectionConfig = {
	notFoundMessage: "Country Not Found",
	redirectBase: "/country",
	isValidArea: (area) => /^[\w-]+$/.test(area),
	hasRequiredTags: () => true,
};

const captureThrow = async (fn: () => Promise<unknown>): Promise<unknown> => {
	try {
		await fn();
	} catch (err) {
		return err;
	}
	throw new Error("expected the function to throw, but it resolved");
};

beforeEach(() => {
	// The helper logs caught errors; silence to keep test output pristine.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("loadAreaSection", () => {
	it("rejects an area that fails the config validation with a 404", async () => {
		const fetch = makeFetch();

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "bad/area", section: "merchants" }, fetch },
				countryConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
			expect(err.body.message).toBe("Country Not Found");
		}
		expect(fetch).not.toHaveBeenCalled();
	});

	it("allows non-Latin aliases through the community validation", async () => {
		const fetch = makeFetch();

		const result = await loadAreaSection(
			{ params: { area: "日本", section: "merchants" }, fetch },
			communityConfig,
		);

		expect(result.data.id).toBe("some-area");
		// The area is percent-encoded in the upstream request.
		expect(fetch.mock.calls[0][0].toString()).toContain(
			encodeURIComponent("日本"),
		);
	});

	it("redirects to the merchants section when the section is invalid", async () => {
		const fetch = makeFetch();

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "café", section: "bogus" }, fetch },
				communityConfig,
			),
		);

		expect(isRedirect(err)).toBe(true);
		if (isRedirect(err)) {
			expect(err.status).toBe(302);
			expect(err.location).toBe(
				`/community/${encodeURIComponent("café")}/merchants`,
			);
		}
		expect(fetch).not.toHaveBeenCalled();
	});

	it("maps a 404 from the area endpoint to a not-found error", async () => {
		const fetch = makeFetch({ areas: { ok: false, status: 404 } });

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
			expect(err.body.message).toBe("Community Not Found");
		}
	});

	it("maps a 410 from the area endpoint to a not-found error", async () => {
		const fetch = makeFetch({ areas: { ok: false, status: 410 } });

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				countryConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
			expect(err.body.message).toBe("Country Not Found");
		}
	});

	it("maps other upstream area errors to a 502", async () => {
		const fetch = makeFetch({ areas: { ok: false, status: 500 } });

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(502);
		}
	});

	it("returns a 404 when the area is soft-deleted", async () => {
		const fetch = makeFetch({
			areas: { json: () => ({ ...AREA_OK, deleted_at: "2024-05-01" }) },
		});

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
		}
	});

	it("returns a 404 when the area has no tags", async () => {
		const fetch = makeFetch({
			areas: { json: () => ({ id: 42, deleted_at: null }) },
		});

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
		}
	});

	it("maps a failed issues fetch to a 502", async () => {
		const fetch = makeFetch({ issues: { ok: false, status: 500 } });

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "maintain" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(502);
		}
	});

	it("returns the bundle without an issues request for non-maintain sections", async () => {
		const fetch = makeFetch();

		const result = await loadAreaSection(
			{ params: { area: "some-area", section: "stats" }, fetch },
			communityConfig,
		);

		expect(result.data).toEqual({
			id: "some-area",
			numericId: 42,
			name: "Some Area",
			tickets: "maintenance",
			// Issues feed only the maintain section's table — the other
			// sections' SSR payloads must not carry them
			issues: [],
			description: "An area description",
			tags: AREA_OK.tags,
			contacts: {},
			cameraBbox: null,
		});
		expect(result.tags).toEqual(AREA_OK.tags);

		expect(fetch).toHaveBeenCalledTimes(1);
		expect(fetch.mock.calls[0][0].toString()).toContain("/v3/areas/some-area");
	});

	it("fetches issues for the maintain section, paginating past the limit", async () => {
		const page1 = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
		const page2 = [{ id: 10000 }, { id: 10001 }];
		let issuesCall = 0;
		const fetch = makeFetch({
			issues: {
				json: () => ({
					requested_issues: issuesCall++ === 0 ? page1 : page2,
				}),
			},
		});

		const result = await loadAreaSection(
			{ params: { area: "some-area", section: "maintain" }, fetch },
			communityConfig,
		);

		expect(result.data.issues).toHaveLength(10002);
		const issuesUrls = fetch.mock.calls
			.map((call) => call[0].toString())
			.filter((url) => url.includes("/v4/place-issues"));
		expect(issuesUrls).toHaveLength(2);
		expect(issuesUrls[0]).toContain("limit=10000&offset=0");
		expect(issuesUrls[1]).toContain("limit=10000&offset=10000");
	});

	it("maps a malformed issues payload to a 502 instead of an empty table", async () => {
		const fetch = makeFetch({
			issues: { json: () => ({ totally: "unexpected" }) },
		});

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "maintain" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(502);
		}
	});

	it("returns a 404 when url_alias is missing, regardless of config", async () => {
		const { url_alias, ...tagsWithoutAlias } = AREA_OK.tags;
		const fetch = makeFetch({
			areas: { json: () => ({ ...AREA_OK, tags: tagsWithoutAlias }) },
		});

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
			expect(err.body.message).toBe("Community Not Found");
		}
	});

	it("returns a 404 when required tags are missing", async () => {
		const fetch = makeFetch();

		const err = await captureThrow(() =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				{
					...communityConfig,
					hasRequiredTags: (tags) => !!tags["icon:square"] && false,
				},
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(404);
			expect(err.body.message).toBe("Community Not Found");
		}
	});

	it("lifts contact tags into the typed contacts object", async () => {
		const fetch = makeFetch({
			areas: {
				json: () => ({
					...AREA_OK,
					tags: {
						...AREA_OK.tags,
						"contact:website": "https://example.org",
						"contact:telegram": "https://t.me/example",
						"contact:email": "",
					},
				}),
			},
		});

		const result = await loadAreaSection(
			{ params: { area: "some-area", section: "merchants" }, fetch },
			communityConfig,
		);

		// Empty strings are dropped; only authored contacts survive
		expect(result.data.contacts).toEqual({
			website: "https://example.org",
			telegram: "https://t.me/example",
		});
	});

	it("coerces numeric box:* tags into a camera bbox and rejects junk", async () => {
		const withBox = (box: Record<string, unknown>) =>
			makeFetch({
				areas: {
					json: () => ({ ...AREA_OK, tags: { ...AREA_OK.tags, ...box } }),
				},
			});
		const load = (fetch: ReturnType<typeof makeFetch>) =>
			loadAreaSection(
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			);

		// The API serves numbers despite the historical string typing
		const numeric = await load(
			withBox({
				"box:west": -17.3,
				"box:south": 32.5,
				"box:east": -16.2,
				"box:north": 33.2,
			}),
		);
		expect(numeric.data.cameraBbox).toEqual([-17.3, 32.5, -16.2, 33.2]);

		// String-typed values coerce
		const strings = await load(
			withBox({
				"box:west": "-17.3",
				"box:south": "32.5",
				"box:east": "-16.2",
				"box:north": "33.2",
			}),
		);
		expect(strings.data.cameraBbox).toEqual([-17.3, 32.5, -16.2, 33.2]);

		// Junk, inverted, or wrap boxes fall back to the polygon fit
		const junk = await load(withBox({ "box:west": "not-a-number" }));
		expect(junk.data.cameraBbox).toBeNull();
		const inverted = await load(
			withBox({
				"box:west": 10,
				"box:south": 40,
				"box:east": 5,
				"box:north": 45,
			}),
		);
		expect(inverted.data.cameraBbox).toBeNull();
	});
});
