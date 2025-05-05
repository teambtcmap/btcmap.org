
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';
import { getIssues } from '$lib/gitea';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad = async ({ params }) => {
	const { area } = params;
	try {
		const areaResponse = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);
		const fetchedArea = areaResponse.data;

		const { issues: tickets } = await getIssues(fetchedArea.tags.name).catch(() => ({ issues: 'error' }));

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
