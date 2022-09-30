import axios from 'axios';
import { GITHUB_API_KEY } from '$env/static/private';

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let { name, location, edit, outdated, current, verify, lat, long } = await request.json();

	let github = await axios
		.post(
			'https://api.github.com/repos/teambtcmap/btcmap-data/issues',
			{
				title: name,
				body: `Merchant name: ${name}
Merchant location: ${location}
Edit link: ${edit}
Outdated information: ${outdated}
Current information: ${current}
How did you verify this?: ${verify}
Lat: ${lat}
Long: ${long}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}`,
				labels: ['good first issue', 'help wanted', 'outdated-info']
			},
			{ headers }
		)
		.then(function (response) {
			return response.data;
		})
		.catch(function (error) {
			console.log(error);
			throw new Error(error);
		});

	return new Response(JSON.stringify(github));
}
