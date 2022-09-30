import axios from 'axios';
import { GITHUB_API_KEY } from '$env/static/private';

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let {
		name,
		address,
		lat,
		long,
		osm,
		category,
		methods,
		twitterMerchant,
		twitterSubmitter,
		notes
	} = await request.json();

	let github = await axios
		.post(
			'https://api.github.com/repos/teambtcmap/btcmap-data/issues',
			{
				title: name,
				body: `Merchant name: ${name}
Address: ${address}
Lat: ${lat}
Long: ${long}
OSM: ${osm}
Category: ${category}
Payment methods: ${methods}
Twitter merchant: ${twitterMerchant}
Twitter submitter: ${twitterSubmitter}
Notes: ${notes}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}`,
				labels: ['good first issue', 'help wanted', 'location-submission']
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
