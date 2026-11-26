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

import type * as Gitea from "#lib/gitea.js";

const LABELS_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/labels";
const ISSUES_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/issues";

type Label = { id: number; name: string };
type GetConfig = { params?: { page?: number; limit?: number } };

// The label list is cached per module, like it is per warm function
let api: typeof import("#lib/axios.js").default;
let createIssueWithLabels: typeof Gitea.createIssueWithLabels;

// Gitea's label list: 50 a page at most, the total in X-Total-Count
const serveLabels = (labels: Label[], pageSize = 50) =>
	vi.mocked(api.get).mockImplementation(async (_url, config) => {
		const page = (config as GetConfig | undefined)?.params?.page ?? 1;
		return {
			data: labels.slice((page - 1) * pageSize, page * pageSize),
			headers: { "x-total-count": String(labels.length) },
		};
	});

const filler = (count: number, from = 1000): Label[] =>
	Array.from({ length: count }, (_, i) => ({
		id: from + i,
		name: `area-${i}`,
	}));

const labelPagesFetched = () =>
	vi
		.mocked(api.get)
		.mock.calls.filter(([url]) => url === LABELS_URL)
		.map(([, config]) => (config as GetConfig).params?.page);

const issuePost = () =>
	vi.mocked(api.post).mock.calls.findLast(([url]) => url === ISSUES_URL)?.[1];

describe("createIssueWithLabels", () => {
	beforeEach(async () => {
		vi.resetModules();
		api = (await import("#lib/axios.js")).default;
		({ createIssueWithLabels } = await import("#lib/gitea.js"));
		vi.mocked(api.post).mockImplementation(async (url) =>
			url === LABELS_URL ? { data: { id: 900 } } : { data: { number: 1 } },
		);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("files the issue with the area's existing label", async () => {
		vi.mocked(api.get).mockResolvedValue({ data: [{ id: 7, name: "us" }] });

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(api.post).toHaveBeenCalledExactlyOnceWith(
			ISSUES_URL,
			{ title: "Cafe", body: "body", labels: [3, 7] },
			expect.anything(),
		);
	});

	// The repo has ~950 labels; reading only the first page (30) missed
	// most area labels, and each submission created its label again
	it("finds a label past the first page, reading every page at Gitea's largest size", async () => {
		serveLabels([...filler(120), { id: 7, name: "us" }]);

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(labelPagesFetched().sort()).toEqual([1, 2, 3]);
		expect(api.get).toHaveBeenCalledWith(LABELS_URL, {
			headers: expect.anything(),
			params: { page: 1, limit: 50 },
		});
		expect(issuePost()).toEqual({
			title: "Cafe",
			body: "body",
			labels: [3, 7],
		});
		expect(api.post).toHaveBeenCalledTimes(1);
	});

	it("reads on page by page when Gitea sends no total", async () => {
		const labels = [...filler(60), { id: 7, name: "us" }];
		vi.mocked(api.get).mockImplementation(async (_url, config) => {
			const page = (config as GetConfig).params?.page ?? 1;
			return { data: labels.slice((page - 1) * 50, page * 50) };
		});

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(issuePost()).toMatchObject({ labels: [3, 7] });
		expect(api.post).toHaveBeenCalledTimes(1);
	});

	// Earlier submissions left duplicates; the oldest is the one to keep
	it("uses the oldest of several labels with the name", async () => {
		serveLabels([
			{ id: 41, name: "us" },
			...filler(70),
			{ id: 12, name: "us" },
		]);

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(issuePost()).toMatchObject({ labels: [3, 12] });
	});

	it("reuses the list for the next submission", async () => {
		serveLabels([...filler(70), { id: 7, name: "us" }]);

		await createIssueWithLabels("A", "body", [3], "btcmap-data", ["us"]);
		await createIssueWithLabels("B", "body", [3], "btcmap-data", ["us"]);

		// Both pages once, for the first submission only
		expect(labelPagesFetched().sort()).toEqual([1, 2]);
	});

	// Another function may have made it since this one cached the list
	it("checks a fresh list once before creating a missing label", async () => {
		serveLabels(filler(70));

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["new"]);

		expect(labelPagesFetched()).toHaveLength(4);
		expect(api.post).toHaveBeenCalledWith(
			LABELS_URL,
			expect.objectContaining({ name: "new" }),
			expect.anything(),
		);
		expect(issuePost()).toMatchObject({ labels: [3, 900] });
	});

	it("creates a missing label only once across submissions", async () => {
		serveLabels(filler(70));

		await createIssueWithLabels("A", "body", [3], "btcmap-data", ["new"]);
		await createIssueWithLabels("B", "body", [3], "btcmap-data", ["new"]);

		const labelPosts = vi
			.mocked(api.post)
			.mock.calls.filter(([url]) => url === LABELS_URL);
		expect(labelPosts).toHaveLength(1);
		expect(issuePost()).toMatchObject({ labels: [3, 900] });
	});

	// #1681: a label list that couldn't be fetched read as "no labels", so
	// the area's label was created a second time while Gitea was flaky, or
	// the issue went out without it
	it("files nothing when the label list can't be fetched", async () => {
		const refused = new Error("connect ECONNREFUSED");
		vi.mocked(api.get).mockRejectedValue(refused);

		await expect(
			createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]),
		).rejects.toBe(refused);

		expect(api.get).toHaveBeenCalledWith(LABELS_URL, expect.anything());
		expect(api.post).not.toHaveBeenCalled();
	});

	it("fetches the list again after a failed fetch", async () => {
		vi.mocked(api.get).mockRejectedValueOnce(new Error("refused"));
		await expect(
			createIssueWithLabels("A", "body", [3], "btcmap-data", ["us"]),
		).rejects.toThrow("refused");

		serveLabels([{ id: 7, name: "us" }]);
		await createIssueWithLabels("B", "body", [3], "btcmap-data", ["us"]);

		expect(issuePost()).toMatchObject({ labels: [3, 7] });
	});
});
