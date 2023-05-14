import axios from 'axios';
import axiosRetry from 'axios-retry';
import { error } from '@sveltejs/kit';
import { GITHUB_API_KEY } from '$env/static/private';

axiosRetry(axios, { retries: 3 });

export async function load({ params }) {
	let { area } = params;
	try {
		const response = await axios.get(`https://api.btcmap.org/v2/areas/${area}`);

		const data = response.data;

		if (data && data.id && data.tags && data.tags.name) {
			const headers = {
				Authorization: `Bearer ${GITHUB_API_KEY}`,
				Accept: 'application/vnd.github+json'
			};

			let issues = await axios
				.get(
					`https://api.github.com/repos/teambtcmap/btcmap-data/issues?per_page=100&labels=${data.tags.name}`,
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

			return { id: data.id, name: data.tags.name, tickets: issues };
		}
	} catch (err) {
		throw error(404, 'Community Not Found');
	}
}
