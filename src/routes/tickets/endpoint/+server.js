import axios from 'axios';
import { json } from '@sveltejs/kit';
import { GITHUB_API_KEY } from '$env/static/private';

export async function GET() {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let issues = await axios
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

	let total = await axios
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
