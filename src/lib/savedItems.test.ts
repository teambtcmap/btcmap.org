import { describe, expect, it, vi } from "vitest";

import { API_BASE } from "$lib/api-base";

import { addSavedItem, removeSavedItem } from "./savedItems";

vi.mock("$lib/axios", () => ({
	default: {
		post: vi.fn(async () => ({ data: [5] })),
		delete: vi.fn(async () => ({ data: [] })),
	},
}));

describe("addSavedItem", () => {
	it("POSTs the id as explicit JSON — axios would form-encode a bare number", async () => {
		const { default: api } = await import("$lib/axios");
		const ids = await addSavedItem("place", "tok", 5);

		expect(api.post).toHaveBeenCalledWith(
			`${API_BASE}/v4/places/saved`,
			JSON.stringify(5),
			{
				headers: {
					Authorization: "Bearer tok",
					"Content-Type": "application/json",
				},
			},
		);
		expect(ids).toEqual([5]);
	});
});

describe("removeSavedItem", () => {
	it("DELETEs the per-id endpoint with the Bearer token", async () => {
		const { default: api } = await import("$lib/axios");
		const ids = await removeSavedItem("area", "tok", 7);

		expect(api.delete).toHaveBeenCalledWith(`${API_BASE}/v4/areas/saved/7`, {
			headers: { Authorization: "Bearer tok" },
		});
		expect(ids).toEqual([]);
	});
});
