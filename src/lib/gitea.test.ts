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
import type { GiteaLabel } from "#lib/types.js";

const LABELS_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/labels";
const ISSUES_URL =
	"https://gitea.test/api/v1/repos/teambtcmap/btcmap-data/issues";

type Label = Pick<GiteaLabel, "id" | "name">;
type ListParams = { params?: { page?: number; limit?: number } };

// The label list is cached per module, like it is per warm function
let api: typeof import("#lib/axios.js").default;
let createIssueWithLabels: typeof Gitea.createIssueWithLabels;

// Gitea's label list: `pageSize` a page (50 at most), the total in
// X-Total-Count unless `total` is false
const serveLabels = (
	labels: Label[],
	{ pageSize = 50, total = true }: { pageSize?: number; total?: boolean } = {},
) =>
	vi.mocked(api.get).mockImplementation(async (_url, config) => {
		const page = (config as ListParams | undefined)?.params?.page ?? 1;
		return {
			data: labels.slice((page - 1) * pageSize, page * pageSize),
			headers: total ? { "x-total-count": String(labels.length) } : {},
		};
	});

const filler = (count: number): Label[] =>
	Array.from({ length: count }, (_, i) => ({
		id: 1000 + i,
		name: `area-${i}`,
	}));

const labelPagesFetched = () =>
	vi
		.mocked(api.get)
		.mock.calls.filter(([url]) => url === LABELS_URL)
		.map(([, config]) => (config as ListParams).params?.page);

const labelsCreated = () =>
	vi
		.mocked(api.post)
		.mock.calls.filter(([url]) => url === LABELS_URL)
		.map(([, payload]) => (payload as { name: string }).name);

const lastIssuePayload = () =>
	vi.mocked(api.post).mock.calls.findLast(([url]) => url === ISSUES_URL)?.[1];

describe("createIssueWithLabels", () => {
	beforeEach(async () => {
		vi.resetModules();
		api = (await import("#lib/axios.js")).default;
		({ createIssueWithLabels } = await import("#lib/gitea.js"));
		let nextLabelId = 900;
		vi.mocked(api.post).mockImplementation(async (url) =>
			url === LABELS_URL
				? { data: { id: nextLabelId++ } }
				: { data: { number: 1 } },
		);
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("files the issue with the area's existing label", async () => {
		serveLabels([{ id: 7, name: "us" }]);

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
		expect(lastIssuePayload()).toEqual({
			title: "Cafe",
			body: "body",
			labels: [3, 7],
		});
		expect(labelsCreated()).toEqual([]);
	});

	it("asks for the remaining pages at once", async () => {
		const labels = [...filler(120), { id: 7, name: "us" }];
		const held: (() => void)[] = [];
		vi.mocked(api.get).mockImplementation(async (_url, config) => {
			const page = (config as ListParams).params?.page ?? 1;
			if (page > 1) await new Promise<void>((resolve) => held.push(resolve));
			return {
				data: labels.slice((page - 1) * 50, page * 50),
				headers: { "x-total-count": String(labels.length) },
			};
		});

		const filing = createIssueWithLabels("Cafe", "body", [3], "btcmap-data", [
			"us",
		]);
		// Pages 2 and 3 both asked for before either answers
		await vi.waitFor(() => expect(held).toHaveLength(2));
		for (const release of held) release();
		await filing;

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
	});

	it("finds a label when Gitea serves smaller pages than asked for", async () => {
		serveLabels([...filler(40), { id: 7, name: "us" }], { pageSize: 30 });

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
		expect(labelsCreated()).toEqual([]);
	});

	it("reads on page by page when Gitea sends no total", async () => {
		serveLabels([...filler(60), { id: 7, name: "us" }], { total: false });

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
		expect(labelsCreated()).toEqual([]);
	});

	it("reads on page by page when Gitea serves smaller pages and no total", async () => {
		serveLabels([...filler(40), { id: 7, name: "us" }], {
			pageSize: 30,
			total: false,
		});

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
		expect(labelsCreated()).toEqual([]);
	});

	// Number("") is 0: an empty header must not read as "no labels past page 1"
	it("treats an empty total as no total", async () => {
		const labels = [...filler(60), { id: 7, name: "us" }];
		vi.mocked(api.get).mockImplementation(async (_url, config) => {
			const page = (config as ListParams).params?.page ?? 1;
			return {
				data: labels.slice((page - 1) * 50, page * 50),
				headers: { "x-total-count": "" },
			};
		});

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
	});

	it("stops at 100 pages, and says so", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.mocked(api.get).mockImplementation(async () => ({
			data: filler(50),
			headers: { "x-total-count": "1000000" },
		}));

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["area-1"]);

		expect(labelPagesFetched()).toHaveLength(100);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("100 pages"));
	});

	// Earlier submissions left duplicates; the oldest is the one to keep
	it("uses the oldest of several labels with the name", async () => {
		serveLabels([
			{ id: 41, name: "us" },
			...filler(70),
			{ id: 12, name: "us" },
		]);

		await createIssueWithLabels("Cafe", "body", [3], "btcmap-data", ["us"]);

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 12] });
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
		expect(labelsCreated()).toEqual(["new"]);
		expect(lastIssuePayload()).toMatchObject({ labels: [3, 900] });
	});

	// One submission's area labels: one list read, one fresh read for all
	// the missing ones, and the labels made land in the cached list
	it("reads the list once for several area labels, and keeps the labels it makes", async () => {
		serveLabels([...filler(70), { id: 7, name: "us" }]);

		await createIssueWithLabels("A", "body", [3], "btcmap-data", [
			"us",
			"new-a",
			"new-b",
		]);

		expect(labelPagesFetched()).toHaveLength(4);
		expect(labelsCreated().sort()).toEqual(["new-a", "new-b"]);
		expect(lastIssuePayload()).toMatchObject({
			labels: [3, 7, expect.any(Number), expect.any(Number)],
		});

		await createIssueWithLabels("B", "body", [3], "btcmap-data", [
			"new-a",
			"new-b",
		]);
		expect(labelPagesFetched()).toHaveLength(4);
		expect(labelsCreated()).toHaveLength(2);
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

		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
	});

	it("keeps the cached list when a fresh read fails", async () => {
		serveLabels([{ id: 7, name: "us" }]);
		await createIssueWithLabels("A", "body", [3], "btcmap-data", ["us"]);

		vi.mocked(api.get).mockRejectedValueOnce(new Error("refused"));
		await expect(
			createIssueWithLabels("B", "body", [3], "btcmap-data", ["new"]),
		).rejects.toThrow("refused");

		await createIssueWithLabels("C", "body", [3], "btcmap-data", ["us"]);
		// One read for A, the failed fresh one for B, none for C
		expect(labelPagesFetched()).toHaveLength(2);
		expect(lastIssuePayload()).toMatchObject({ labels: [3, 7] });
	});
});
