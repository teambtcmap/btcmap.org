import { get } from "svelte/store";

import api from "#lib/axios.js";
import { areas } from "#lib/store.js";
import type { GiteaIssue, GiteaLabel } from "#lib/types.js";
import { getRandomColor } from "#lib/utils.js";

import * as env from "$app/env/private";

// Cache structure with TTL
type IssuesCache = {
	timestamp: number;
	data: GiteaIssue[];
	totalCount: number;
};

let issuesCache: IssuesCache | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export type GiteaRepo = "btcmap-data" | "btcmap-infra";

async function syncIssuesFromGitea(): Promise<IssuesCache> {
	// Check if required environment variables are available
	if (!env.GITEA_API_URL || !env.GITEA_API_KEY) {
		console.warn(
			"Gitea API configuration missing (GITEA_API_URL or GITEA_API_KEY). Returning empty cache.",
		);
		return {
			timestamp: Date.now(),
			data: [],
			totalCount: 0,
		};
	}

	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	const [issuesResponse, repoResponse] = await Promise.all([
		api.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open`,
			{
				headers,
			},
		),
		api.get(`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data`, {
			headers,
		}),
	]);

	const giteaIssues = issuesResponse.data.map((issue: GiteaIssue) => ({
		id: issue.id,
		number: issue.number,
		title: issue.title,
		created_at: issue.created_at,
		html_url: issue.html_url,
		labels: issue.labels,
		user: {
			login: issue.user.login,
			avatar_url: issue.user.avatar_url,
			html_url: issue.user.html_url,
		},
		comments: issue.comments,
		assignees: issue.assignees,
	}));

	return {
		timestamp: Date.now(),
		data: giteaIssues,
		totalCount: repoResponse.data.open_issues_count,
	};
}

export async function getIssues(
	labelNames?: string[],
): Promise<{ issues: GiteaIssue[]; totalCount: number }> {
	// Refresh cache if expired or doesn't exist
	if (!issuesCache || Date.now() - issuesCache.timestamp > CACHE_DURATION) {
		try {
			issuesCache = await syncIssuesFromGitea();
		} catch (error) {
			console.error("Failed to sync issues from Gitea:", error);
			throw error;
		}
	}

	// If no labels specified, return all issues
	if (!labelNames || labelNames.length === 0) {
		return {
			issues: issuesCache.data,
			totalCount: issuesCache.totalCount,
		};
	}

	// Filter issues by labels
	const filteredIssues = issuesCache.data.filter((issue) => {
		const issueLabels = new Set(issue.labels.map((l) => l.name.toLowerCase()));
		return labelNames.every((labelName) =>
			issueLabels.has(labelName.toLowerCase()),
		);
	});

	return {
		issues: filteredIssues,
		totalCount: filteredIssues.length,
	};
}

// Gitea serves at most this many items per page (its max_response_items)
const LABEL_PAGE_SIZE = 50;
// A bound on the pages read, whatever the server claims
const MAX_LABEL_PAGES = 100;

type LabelIds = Map<GiteaLabel["name"], GiteaLabel["id"]>;

// Every label of a repo by name. The list runs to ~950 labels over many
// pages; reading only the first page (30 by default) missed most area
// labels, and createLabel made them again: duplicates such as eleven
// "bitcoin-beach". Of duplicates already there, the oldest (lowest id)
// counts. A failed fetch rejects: read as "no labels", it had createLabel
// make an existing label a second time (#1681).
async function fetchLabelIds(repo: GiteaRepo): Promise<LabelIds> {
	const url = `${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`;
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};
	const fetchPage = async (page: number) =>
		api.get<GiteaLabel[]>(url, {
			headers,
			params: { page, limit: LABEL_PAGE_SIZE },
		});
	const warnCut = () =>
		console.warn(
			`[gitea] Read only the first ${MAX_LABEL_PAGES} pages of the ${repo} labels: labels past them will be made again`,
		);

	const first = await fetchPage(1);
	const labels = [...first.data];
	// What Gitea actually served, should it cap pages below the size asked
	const pageSize = first.data.length;
	// An empty header is no total (Number("") is 0)
	const totalHeader = first.headers?.["x-total-count"];
	const total = totalHeader ? Number(totalHeader) : Number.NaN;

	if (Number.isInteger(total) && pageSize > 0) {
		// The rest at once: one after another, ~20 pages took seconds
		const pageCount = Math.ceil(total / pageSize);
		if (pageCount > MAX_LABEL_PAGES) warnCut();
		const rest = await Promise.all(
			Array.from({ length: Math.min(pageCount, MAX_LABEL_PAGES) - 1 }, (_, i) =>
				fetchPage(i + 2),
			),
		);
		for (const page of rest) labels.push(...page.data);
	} else {
		// No total: read on until a page comes back shorter than the first
		let last = first.data;
		for (let page = 2; pageSize > 0 && last.length === pageSize; page++) {
			if (page > MAX_LABEL_PAGES) {
				warnCut();
				break;
			}
			last = (await fetchPage(page)).data;
			labels.push(...last);
		}
	}

	const ids: LabelIds = new Map();
	for (const { id, name } of labels) {
		const known = ids.get(name);
		if (known === undefined || id < known) ids.set(name, id);
	}
	return ids;
}

type LabelIdsCacheEntry = { timestamp: number; ids: Promise<LabelIds> };

// The label list, kept for the warm function like the issues. A fetch in
// flight is shared; a failed one isn't kept, and the list it was to
// replace stays.
const labelIdsCache = new Map<GiteaRepo, LabelIdsCacheEntry>();

function getLabelIds(
	repo: GiteaRepo,
	{ fresh = false } = {},
): Promise<LabelIds> {
	const cached = labelIdsCache.get(repo);
	if (!fresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.ids;
	}
	const entry: LabelIdsCacheEntry = {
		timestamp: Date.now(),
		ids: fetchLabelIds(repo),
	};
	labelIdsCache.set(repo, entry);
	entry.ids.catch(() => {
		if (labelIdsCache.get(repo) !== entry) return;
		if (cached) labelIdsCache.set(repo, cached);
		else labelIdsCache.delete(repo);
	});
	return entry.ids;
}

// The ids of an issue's area labels, making the ones Gitea doesn't have.
// One read of the list for all of them, and one fresh read when any is
// missing: another function may have made it since this one read the list.
// The labels made go into that fresh list, which is the cached one now.
async function resolveAreaLabelIds(
	names: string[],
	repo: GiteaRepo,
): Promise<number[]> {
	if (names.length === 0) return [];
	let ids = await getLabelIds(repo);
	if (names.some((name) => !ids.has(name))) {
		ids = await getLabelIds(repo, { fresh: true });
	}
	const knownIds = ids;
	return Promise.all(
		names.map(
			(name) => knownIds.get(name) ?? createLabel(name, repo, knownIds),
		),
	);
}

async function createLabel(
	name: string,
	repo: GiteaRepo,
	ids: LabelIds,
): Promise<number> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	try {
		const areaDetails = get(areas).find((area) => area.id === name);
		const areaType = areaDetails?.tags?.type;
		const areaName = areaDetails?.tags?.name || name;

		let color = "";
		if (areaType === "country") {
			color = "4A90E2";
		} else if (areaType === "community") {
			color = "7ED321";
		} else {
			color = getRandomColor().substring(1);
		}

		const response = await api.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`,
			{
				name,
				color,
				description: `Auto-generated label for ${areaName}${areaType ? ` (${areaType})` : ""}`,
			},
			{ headers },
		);
		ids.set(name, response.data.id);
		return response.data.id;
	} catch (error) {
		console.error(`Failed to create label ${name}:`, error);
		throw error;
	}
}

export async function createIssueWithLabels(
	title: string,
	body: string,
	labelIds: number[],
	repo: GiteaRepo = "btcmap-data",
	areaLabels: string[] = [],
) {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	try {
		// Get IDs for area labels (create if they don't exist)
		const areaLabelIds = await resolveAreaLabelIds(areaLabels, repo);
		const allLabelIds = [...labelIds, ...areaLabelIds];

		const response = await api.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/issues`,
			{ title, body, labels: allLabelIds },
			{ headers },
		);

		// Only invalidate cache for btcmap-data repo
		if (repo === "btcmap-data") {
			issuesCache = null;
		}

		return response;
	} catch (error) {
		console.error(`Failed to create issue in ${repo}:`, error);
		throw error;
	}
}
