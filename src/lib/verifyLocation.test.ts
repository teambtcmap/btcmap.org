import { describe, expect, it, vi } from "vitest";

import { verifyLocationHref } from "./verifyLocation";

vi.mock("$app/paths", () => ({
	resolve: (path: string) => `/base${path}`,
}));

describe("verifyLocationHref", () => {
	it("links the page under the app's base path", () => {
		expect(verifyLocationHref("123")).toBe("/base/verify-location?id=123");
	});

	it("encodes an OSM-style id", () => {
		expect(verifyLocationHref("node:123")).toBe(
			"/base/verify-location?id=node%3A123",
		);
	});
});
