import { GITHUB_API_KEY } from '$env/static/private';
import { json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3 });

export async function GET() {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	const issues = await axios
		.get('https://api.github.com/repos/teambtcmap/btcmap-data/issues?per_page=100', { headers })
		.then(function (response) {
			// handle success
			return response.data;
		})
		.catch(function (error) {
			// handle error
			console.log(error);
			throw new Error(error);
		});

	const total = await axios
		.get('https://api.github.com/repos/teambtcmap/btcmap-data', { headers })
		.then(function (response) {
			// handle success
			return response.data.open_issues_count;
		})
		.catch(function (error) {
			// handle error
			console.log(error);
			throw new Error(error);
		});

	return json({ tickets: issues, totalTickets: total });
}
