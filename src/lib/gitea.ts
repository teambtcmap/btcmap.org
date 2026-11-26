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
// A bound on the pages read, whatever the server claims: 5,000 labels
const MAX_LABEL_PAGES = 100;

// Every label of a repo by name. The list runs to ~950 labels over many
// pages; reading only the first page (30 by default) missed most area
// labels, and createLabel made them again: duplicates such as eleven
// "bitcoin-beach". Of duplicates already there, the oldest (lowest id)
// counts. A failed fetch rejects: read as "no labels", it had createLabel
// make an existing label a second time (#1681).
async function fetchLabelIds(repo: GiteaRepo): Promise<Map<string, number>> {
	const url = `${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`;
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};
	const fetchPage = async (page: number) =>
		api.get<GiteaLabel[]>(url, {
			headers,
			params: { page, limit: LABEL_PAGE_SIZE },
		});

	const first = await fetchPage(1);
	const labels = [...first.data];
	// What Gitea actually served, should it cap pages below the size asked
	const pageSize = first.data.length;
	const total = Number(first.headers?.["x-total-count"]);
	if (Number.isInteger(total) && pageSize > 0) {
		// The rest at once: one after another, ~20 pages took seconds
		const pageCount = Math.min(Math.ceil(total / pageSize), MAX_LABEL_PAGES);
		const rest = await Promise.all(
			Array.from({ length: pageCount - 1 }, (_, i) => fetchPage(i + 2)),
		);
		for (const page of rest) labels.push(...page.data);
	} else {
		// No total: read on until a page comes back short of a full one
		let last = first.data;
		for (
			let page = 2;
			last.length >= LABEL_PAGE_SIZE && page <= MAX_LABEL_PAGES;
			page++
		) {
			last = (await fetchPage(page)).data;
			labels.push(...last);
		}
	}

	const ids = new Map<string, number>();
	for (const { id, name } of labels) {
		const known = ids.get(name);
		if (known === undefined || id < known) ids.set(name, id);
	}
	return ids;
}

// The label list, kept for the warm function like the issues. A fetch in
// flight is shared, so the area labels of one submission (looked up at
// once) read it once; a failed one isn't kept.
const labelIdsCache = new Map<
	GiteaRepo,
	{ timestamp: number; ids: Promise<Map<string, number>> }
>();

function getLabelIds(
	repo: GiteaRepo,
	{ fresh = false } = {},
): Promise<Map<string, number>> {
	const cached = labelIdsCache.get(repo);
	if (!fresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
		return cached.ids;
	}
	const ids = fetchLabelIds(repo);
	labelIdsCache.set(repo, { timestamp: Date.now(), ids });
	ids.catch(() => {
		if (labelIdsCache.get(repo)?.ids === ids) labelIdsCache.delete(repo);
	});
	return ids;
}

async function createLabel(
	name: string,
	repo: GiteaRepo = "btcmap-data",
): Promise<number | null> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	try {
		const cachedId = (await getLabelIds(repo)).get(name);
		if (cachedId !== undefined) return cachedId;

		// Another function may have made it since this one read the list
		const labelIds = await getLabelIds(repo, { fresh: true });
		const existingId = labelIds.get(name);
		if (existingId !== undefined) return existingId;

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
		labelIds.set(name, response.data.id);
		return response.data.id;
	} catch (error) {
		console.error(`Failed to create/get label ${name}:`, error);
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
		const areaLabelIds = await Promise.all(
			areaLabels.map((name) => createLabel(name, repo)),
		);
		const validAreaLabelIds = areaLabelIds.filter(
			(id): id is number => id !== null,
		);

		const allLabelIds = [...labelIds, ...validAreaLabelIds];

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
