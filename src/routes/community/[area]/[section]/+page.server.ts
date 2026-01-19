import { error, redirect } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';

import type { PageServerLoad } from './$types';
import type { GiteaIssue, Tickets } from '$lib/types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

type TicketsResponse = {
	issues: GiteaIssue[];
	totalCount: number;
	error?: string;
};

function filterIssuesByLabel(issues: GiteaIssue[], labelName: string): GiteaIssue[] {
	return issues.filter((issue) =>
		issue.labels.some((label) => label.name.toLowerCase() === labelName.toLowerCase())
	);
}

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { area, section } = params;

	// Validate section parameter
	const validSections = ['merchants', 'stats', 'activity', 'maintain'];
	if (!validSections.includes(section)) {
		throw redirect(302, `/community/${area}/merchants`);
	}
	try {
		const areaResponse = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);
		const fetchedArea = areaResponse.data;

		// Fetch from cached /api/tickets endpoint and filter by area label
		let tickets: Tickets;
		try {
			const ticketsResponse = await fetch('/api/tickets');
			const ticketsData: TicketsResponse = await ticketsResponse.json();
			tickets = filterIssuesByLabel(ticketsData.issues, fetchedArea.tags.url_alias);
		} catch {
			tickets = 'error';
		}

		const issuesResponse = await fetch('https://api.btcmap.org/rpc', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'get_element_issues',
				params: {
					area_id: fetchedArea.tags['btcmap:id'],
					limit: 10_000,
					offset: 0
				}
			})
		});

		const issues = await issuesResponse.json();

		return {
			id: fetchedArea.id,
			name: fetchedArea.tags.name,
			tickets: tickets,
			issues: issues.result.requested_issues
		};
	} catch (err) {
		console.error(err);
		throw error(404, 'Community Not Found');
	}
};
