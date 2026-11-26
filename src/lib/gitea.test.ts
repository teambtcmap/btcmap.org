import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$app/env/private", () => ({
	GITEA_API_URL: "https://gitea.test",
	GITEA_API_KEY: "key",
}));
vi.mock("#lib/axios.js", () => ({
	default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("#lib/store.js", async () => {
	const { writable } = await import("svelte/store");
	return { areas: writable([]) };
});
vi.mock("#lib/utils.js", () => ({ getRandomColor: () => "#123456" }));

import api from "#lib/axios.js";
import { createIssueWithLabels } from "#lib/gitea.js";

const LABELS_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/labels";
const ISSUES_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/issues";

describe("createIssueWithLabels", () => {
	beforeEach(() => {
		vi.mocked(api.get).mockReset();
		vi.mocked(api.post).mockReset();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("files the issue with the area's existing label", async () => {
		vi.mocked(api.get).mockResolvedValue({ data: [{ id: 7, name: "us" }] });
		vi.mocked(api.post).mockResolvedValue({ data: { number: 1 } });

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(api.post).toHaveBeenCalledExactlyOnceWith(
			ISSUES_URL,
			{ title: "Cafe", body: "body", labels: [3, 7] },
			expect.anything(),
		);
	});

	// #1681: a label list that couldn't be fetched read as "no labels", so
	// the area's label was created a second time while Gitea was flaky, or
	// the issue went out without it
	it("files nothing when the label list can't be fetched", async () => {
		const refused = new Error("connect ECONNREFUSED");
		vi.mocked(api.get).mockRejectedValue(refused);
		vi.mocked(api.post).mockResolvedValue({ data: { id: 8, number: 1 } });

		await expect(
			createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]),
		).rejects.toBe(refused);

		expect(api.get).toHaveBeenCalledWith(LABELS_URL, expect.anything());
		expect(api.post).not.toHaveBeenCalled();
	});
});
