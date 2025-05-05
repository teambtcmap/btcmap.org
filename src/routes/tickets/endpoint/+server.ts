
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';
import { json } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export async function GET() {
	const headers = {
		Authorization: `token ${GITEA_API_KEY}`
	};

	const issues = await axios
		.get(`${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open&limit=100`, { headers })
		.then(function (response) {
			return response.data;
		})
		.catch(function (error) {
			console.error(error);
			throw new Error(error);
		});

	const repoInfo = await axios
		.get(`${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data`, { headers })
		.then(function (response) {
			return response.data;
		})
		.catch(function (error) {
			console.error(error);
			throw new Error(error);
		});

	return json({ tickets: issues, totalTickets: repoInfo.open_issues_count });
}
