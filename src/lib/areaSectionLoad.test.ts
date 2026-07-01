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
		url_alias: "some-area",
		name: "Some Area",
		description: "An area description",
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
};

const countryConfig: AreaSectionConfig = {
	notFoundMessage: "Country Not Found",
	redirectBase: "/country",
	isValidArea: (area) => /^[\w-]+$/.test(area),
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
				{ params: { area: "some-area", section: "merchants" }, fetch },
				communityConfig,
			),
		);

		expect(isHttpError(err)).toBe(true);
		if (isHttpError(err)) {
			expect(err.status).toBe(502);
		}
	});

	it("returns mapped area + issues data and requests the expected endpoints", async () => {
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
			issues: ISSUES_OK.requested_issues,
			description: "An area description",
		});
		expect(result.tags).toEqual(AREA_OK.tags);

		const areaUrl = fetch.mock.calls[0][0].toString();
		const issuesUrl = fetch.mock.calls[1][0].toString();
		expect(areaUrl).toContain("/v3/areas/some-area");
		expect(issuesUrl).toContain(
			"/v4/place-issues?area_id=42&limit=10000&offset=0",
		);
	});
});
