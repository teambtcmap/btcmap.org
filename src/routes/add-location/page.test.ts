import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";

import { load } from "./+page";

// The guard only reads url.searchParams — the rest of the load event is
// irrelevant, so a bare URL stands in for it.
const run = (search: string) =>
	load({
		url: new URL(`https://btcmap.org/add-location${search}`),
	} as Parameters<typeof load>[0]);

const expectPlacementRedirect = (search: string) => {
	try {
		run(search);
	} catch (err) {
		if (!isRedirect(err)) throw err;
		expect(err.status).toBe(302);
		expect(err.location).toBe("/map?add=redirect");
		return;
	}
	throw new Error(`expected ${search || "(no query)"} to redirect`);
};

describe("/add-location load guard", () => {
	it("passes a valid map-placed pin through to the page", () => {
		expect(run("?lat=52.52000&long=13.40500")).toEqual({
			coords: { lat: 52.52, long: 13.405 },
		});
	});

	it("redirects to placement mode when the pin is missing", () => {
		expectPlacementRedirect("");
	});

	it("redirects when only one coordinate is present", () => {
		expectPlacementRedirect("?lat=52.52");
	});

	it("redirects on out-of-range or non-numeric coordinates", () => {
		expectPlacementRedirect("?lat=95&long=13.405");
		expectPlacementRedirect("?lat=abc&long=13.405");
	});
});
