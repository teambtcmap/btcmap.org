import { describe, expect, it } from "vitest";

import { load } from "./+page";

// The load only reads url.searchParams and forwards the server load's
// data — a bare URL and a stand-in payload cover the event.
const SERVER_DATA = { geo: { lat: 48.2, lng: 16.4 }, merchantOgImage: null };
const run = (search: string) =>
	load({
		url: new URL(`https://btcmap.org/map${search}`),
		data: SERVER_DATA,
	} as unknown as Parameters<typeof load>[0]);

describe("/map load", () => {
	it("captures the placement entry method from ?add", () => {
		expect(run("?add=nav")).toMatchObject({ addEntryMethod: "nav" });
		expect(run("?add=redirect")).toMatchObject({ addEntryMethod: "redirect" });
	});

	it("folds bare, absent and unknown values into url", () => {
		expect(run("?add=")).toMatchObject({ addEntryMethod: "url" });
		expect(run("?add")).toMatchObject({ addEntryMethod: "url" });
		expect(run("")).toMatchObject({ addEntryMethod: "url" });
		expect(run("?add=bogus")).toMatchObject({ addEntryMethod: "url" });
	});

	it("forwards the server load's data untouched", () => {
		expect(run("?add=nav")).toEqual({ ...SERVER_DATA, addEntryMethod: "nav" });
	});
});
