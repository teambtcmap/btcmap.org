import { json } from '@sveltejs/kit';
import axios from 'axios';
import { env } from '$env/dynamic/private';

import type { RequestHandler } from './$types';
import type { GiteaIssue } from '$lib/types';

async function fetchAllIssuesFromGitea(): Promise<GiteaIssue[]> {
	if (!env.GITEA_API_URL || !env.GITEA_API_KEY) {
		console.warn(
			'Gitea API configuration missing (GITEA_API_URL or GITEA_API_KEY). Returning empty array.'
		);
		return [];
	}

	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	const allIssues: GiteaIssue[] = [];
	let page = 1;
	// Gitea default max is often 50, request 50 per page to be safe
	const limit = 50;

	while (true) {
		const response = await axios.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open&limit=${limit}&page=${page}`,
			{ headers }
		);

		const issues = response.data.map((issue: GiteaIssue) => ({
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

		allIssues.push(...issues);

		// If we got fewer than requested, we've reached the end
		if (response.data.length < limit) break;
		page++;
	}

	return allIssues;
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	// Cache at edge for 24 hours, serve stale for another 24 hours while revalidating
	setHeaders({
		'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400'
	});

	try {
		const issues = await fetchAllIssuesFromGitea();
		return json({ issues, totalCount: issues.length });
	} catch (error) {
		console.error('Failed to fetch issues from Gitea:', error);
		return json({ issues: [], totalCount: 0, error: 'Failed to fetch issues' }, { status: 500 });
	}
};
