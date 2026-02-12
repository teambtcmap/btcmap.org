import axios from "axios";
import { get } from "svelte/store";

import { areas } from "$lib/store";
import type { GiteaIssue, GiteaLabel } from "$lib/types";
import { getRandomColor } from "$lib/utils";

import { env } from "$env/dynamic/private";

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
		axios.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open`,
			{
				headers,
			},
		),
		axios.get(`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data`, {
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

async function getLabels(
	repo: GiteaRepo = "btcmap-data",
): Promise<GiteaLabel[]> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	try {
		const response = await axios.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`,
			{ headers },
		);
		return response.data;
	} catch (error) {
		console.error("Failed to fetch labels:", error);
		return [];
	}
}

async function createLabel(
	name: string,
	repo: GiteaRepo = "btcmap-data",
): Promise<number | null> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`,
	};

	try {
		const existingLabels = await getLabels(repo);
		const existingLabel = existingLabels.find((l) => l.name === name);
		if (existingLabel) {
			return existingLabel.id;
		}

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

		const response = await axios.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`,
			{
				name,
				color,
				description: `Auto-generated label for ${areaName}${areaType ? ` (${areaType})` : ""}`,
			},
			{ headers },
		);
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

		const response = await axios.post(
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
