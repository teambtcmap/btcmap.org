import { afterEach, describe, expect, it, vi } from "vitest";

import { isEmbedded } from "./embed";

afterEach(() => vi.unstubAllGlobals());

describe("isEmbedded", () => {
	it("is false in a top-level window", () => {
		expect(isEmbedded()).toBe(false);
	});

	it("is true inside a frame", () => {
		vi.stubGlobal("top", {});
		expect(isEmbedded()).toBe(true);
	});
});
