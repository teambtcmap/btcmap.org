import { GITHUB_API_KEY } from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad = async ({ params }) => {
	const { area } = params;
	try {
		const areaResponse = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);
		const fetchedArea = areaResponse.data;

		if (fetchedArea && fetchedArea.id && fetchedArea.tags && fetchedArea.tags.name) {
			const headers = {
				Authorization: `Bearer ${GITHUB_API_KEY}`,
				Accept: 'application/vnd.github+json'
			};

			const tickets = await axios
				.get(
					`https://api.github.com/repos/teambtcmap/btcmap-data/issues?per_page=100&labels=${fetchedArea.tags.name}`,
					{ headers }
				)
				.then(function (response) {
					// handle success
					return response.data;
				})
				.catch(function (error) {
					// handle error
					console.log(error);
					return 'error';
				});

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
		}
	} catch (err) {
		error(404, 'Country Not Found');
	}
};
