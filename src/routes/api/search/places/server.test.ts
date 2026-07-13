import { describe, expect, it, vi } from "vitest";

import { GET } from "./+server";

const call = (search: string, fetchImpl: unknown) =>
	(GET as unknown as (event: unknown) => Promise<Response>)({
		url: new URL(`http://localhost/api/search/places${search}`),
		fetch: fetchImpl,
	});

const apiResponse = (body: unknown) =>
	vi
		.fn()
		.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

const requestedUrl = (fetchImpl: ReturnType<typeof apiResponse>) =>
	new URL(fetchImpl.mock.calls[0][0] as string);

describe("GET /api/search/places", () => {
	it("unwraps results and strips the type discriminator", async () => {
		const fetchImpl = apiResponse({
			results: [
				{
					type: "place",
					id: 1,
					name: "Kaffeeklatsch",
					lat: 53.5,
					lon: 9.9,
					icon: "local_cafe",
				},
			],
			total_count: 1,
			has_more: false,
		});

		const res = await call("?name=hamburg", fetchImpl);

		expect(await res.json()).toEqual({
			places: [
				{
					id: 1,
					name: "Kaffeeklatsch",
					lat: 53.5,
					lon: 9.9,
					icon: "local_cafe",
				},
			],
			total: 1,
			hasMore: false,
		});
	});

	it("passes the server's true total through, not the truncated row count", async () => {
		// The API caps `limit`, so a broad query returns far fewer rows than it
		// matched. The panel needs the real total to avoid labelling a truncated
		// slice as the whole result set.
		const fetchImpl = apiResponse({
			results: [{ type: "place", id: 1, name: "A" }],
			total_count: 6171,
			has_more: true,
		});

		const res = await call("?name=str", fetchImpl);

		expect(await res.json()).toMatchObject({ total: 6171, hasMore: true });
	});

	it("calls the omnisearch endpoint scoped to places", async () => {
		const fetchImpl = apiResponse({ results: [] });

		await call("?name=hamburg", fetchImpl);

		const requested = requestedUrl(fetchImpl);
		expect(requested.pathname).toBe("/v4/search/");
		expect(requested.searchParams.get("q")).toBe("hamburg");
		expect(requested.searchParams.get("type_filter")).toBe("place");
	});

	it("forwards lat and lon when both are present", async () => {
		const fetchImpl = apiResponse({ results: [] });

		await call("?name=hamburg&lat=53.5&lon=9.9", fetchImpl);

		const requested = requestedUrl(fetchImpl);
		expect(requested.searchParams.get("lat")).toBe("53.5");
		expect(requested.searchParams.get("lon")).toBe("9.9");
	});

	it("omits lat and lon unless both are present", async () => {
		const fetchImpl = apiResponse({ results: [] });

		await call("?name=hamburg&lat=53.5", fetchImpl);

		const requested = requestedUrl(fetchImpl);
		expect(requested.searchParams.has("lat")).toBe(false);
		expect(requested.searchParams.has("lon")).toBe(false);
	});

	it("rejects a missing name", async () => {
		await expect(call("", apiResponse({ results: [] }))).rejects.toMatchObject({
			status: 400,
		});
	});

	it("tolerates a response with no results array", async () => {
		const res = await call("?name=hamburg", apiResponse({}));
		expect(await res.json()).toEqual({ places: [], total: 0, hasMore: false });
	});
});
