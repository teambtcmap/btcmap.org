import axios from 'axios';
import { env } from '$env/dynamic/private';
import { getRandomColor } from '$lib/utils';
import { get } from 'svelte/store';
import { areas } from '$lib/store';

import type { GiteaLabel, GiteaIssue } from '$lib/types';

// Cache structure with TTL
interface IssuesCache {
	timestamp: number;
	data: GiteaIssue[];
	totalCount: number;
}

let issuesCache: IssuesCache | null = null;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

async function syncIssuesFromGitea(): Promise<IssuesCache> {
	// Check if required environment variables are available
	if (!env.GITEA_API_URL || !env.GITEA_API_KEY) {
		console.warn(
			'Gitea API configuration missing (GITEA_API_URL or GITEA_API_KEY). Returning empty cache.'
		);
		return {
			timestamp: Date.now(),
			data: [],
			totalCount: 0
		};
	}

	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	const [issuesResponse, repoResponse] = await Promise.all([
		axios.get(`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open`, {
			headers
		}),
		axios.get(`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data`, { headers })
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
			html_url: issue.user.html_url
		},
		comments: issue.comments,
		assignees: issue.assignees
	}));

	return {
		timestamp: Date.now(),
		data: giteaIssues,
		totalCount: repoResponse.data.open_issues_count
	};
}

export async function getIssues(
	labelNames?: string[]
): Promise<{ issues: GiteaIssue[]; totalCount: number }> {
	// Refresh cache if expired or doesn't exist
	if (!issuesCache || Date.now() - issuesCache.timestamp > CACHE_DURATION) {
		try {
			issuesCache = await syncIssuesFromGitea();
		} catch (error) {
			console.error('Failed to sync issues from Gitea:', error);
			throw error;
		}
	}

	// If no labels specified, return all issues
	if (!labelNames || labelNames.length === 0) {
		return {
			issues: issuesCache.data,
			totalCount: issuesCache.totalCount
		};
	}

	// Filter issues by labels
	const filteredIssues = issuesCache.data.filter((issue) => {
		const issueLabels = new Set(issue.labels.map((l) => l.name.toLowerCase()));
		return labelNames.every((labelName) => issueLabels.has(labelName.toLowerCase()));
	});

	return {
		issues: filteredIssues,
		totalCount: filteredIssues.length
	};
}

async function getLabels(): Promise<GiteaLabel[]> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		const response = await axios.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
			{ headers }
		);
		return response.data;
	} catch (error) {
		console.error('Failed to fetch labels:', error);
		return [];
	}
}

async function createLabel(name: string): Promise<number | null> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		const existingLabels = await getLabels();
		const existingLabel = existingLabels.find((l) => l.name === name);
		if (existingLabel) {
			return existingLabel.id;
		}

		const areaDetails = get(areas).find((area) => area.id === name);
		const areaType = areaDetails?.tags?.type;
		const areaName = areaDetails?.tags?.name || name;

		if (!areaDetails) {
			console.warn(`Area ${name} not found in store. Creating label without area details.`);
		}

		let color = '';
		if (areaType === 'country') {
			color = '4A90E2'; // Blue color for countries
		} else if (areaType === 'community') {
			color = '7ED321'; // Green color for communities
		} else {
			color = getRandomColor().substring(1); // Random color for other types
		}

		const response = await axios.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
			{
				name,
				color,
				description: `Auto-generated label for ${areaName}${areaType ? ` (${areaType})` : ''}`
			},
			{ headers }
		);
		return response.data.id;
	} catch (error) {
		console.error(`Failed to create/get label ${name}:`, error);
		throw error;
	}
}

export async function createIssueWithLabels(title: string, body: string, labelNames: string[]) {
	console.debug('createIssueWithLabels - Input:', { title, labelNames });
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		console.debug('Attempting to create/get labels...');
		const labelPromises = labelNames.map((name) => createLabel(name));
		const labelIds = await Promise.all(labelPromises);
		console.debug('Label IDs resolved:', labelIds);

		const response = await axios.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues`,
			{ title, body, labels: labelIds },
			{ headers }
		);

		// Invalidate cache after creating new issue
		issuesCache = null;

		return response;
	} catch (error) {
		console.error('Failed to create issue:', error);
		throw error;
	}
}
