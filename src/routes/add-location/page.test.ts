import { isRedirect } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";

import { load } from "./+page";

// The route only reads url.searchParams — the rest of the load event is
// irrelevant, so a bare URL stands in for it.
const run = (search: string) =>
	load({
		url: new URL(`https://btcmap.org/add-location${search}`),
	} as Parameters<typeof load>[0]);

const expectRedirect = (search: string, location: string) => {
	try {
		run(search);
	} catch (err) {
		if (!isRedirect(err)) throw err;
		expect(err.status).toBe(302);
		expect(err.location).toBe(location);
		return;
	}
	throw new Error(`expected ${search || "(no query)"} to redirect`);
};

describe("/add-location redirect", () => {
	it("sends a valid map-placed pin to the in-map form", () => {
		expectRedirect(
			"?lat=52.52000&long=13.40500",
			"/map?add=form#17/52.52000/13.40500",
		);
	});

	it("redirects to placement mode when the pin is missing", () => {
		expectRedirect("", "/map?add=redirect");
	});

	it("redirects to placement mode when only one coordinate is present", () => {
		expectRedirect("?lat=52.52", "/map?add=redirect");
	});

	it("redirects to placement mode on out-of-range or non-numeric coordinates", () => {
		expectRedirect("?lat=95&long=13.405", "/map?add=redirect");
		expectRedirect("?lat=abc&long=13.405", "/map?add=redirect");
	});
});
