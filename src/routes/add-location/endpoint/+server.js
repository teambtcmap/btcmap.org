import axios from 'axios';
import crypto from 'crypto';
import {
	GITHUB_API_KEY,
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR,
	OPENCAGE_API_KEY
} from '$env/static/private';
import { error } from '@sveltejs/kit';

let used = [];

export async function POST({ request }) {
	const headers = {
		Authorization: `Bearer ${GITHUB_API_KEY}`,
		Accept: 'application/vnd.github+json'
	};

	let {
		captchaSecret,
		captchaTest,
		honey,
		name,
		address,
		lat,
		long,
		osm,
		category,
		methods,
		twitterMerchant,
		twitterSubmitter,
		notes,
		source,
		sourceOther,
		contact
	} = await request.json();

	// if honey field has value return
	if (honey) {
		return;
	}

	// verify that captcha is correct
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

	let decrypt = crypto.createDecipheriv('aes-256-cbc', serverKey, initVector);

	let secret = decrypt.update(captchaSecret, 'hex', 'utf8');
	secret += decrypt.final('utf8');

	if (captchaTest !== secret) {
		throw error(400, 'Captcha test failed, please try again or contact BTC Map.');
	}

	if (used.includes(captchaSecret)) {
		throw error(400, 'Captcha has already been used, please try another.');
	} else {
		used.push(captchaSecret);
	}

	let country = await axios
		.get(
			`https://api.opencagedata.com/geocode/v1/json?q=${lat.slice(0, 7)}%2C%20${long.slice(
				0,
				7
			)}&key=${OPENCAGE_API_KEY}&language=en&limit=1&no_annotations=1&no_record=1`
		)
		.then(function (response) {
			return response.data.results[0].components.country;
		})
		.catch(function (error) {
			console.log(error);
		});

	let github = await axios
		.post(
			'https://api.github.com/repos/teambtcmap/btcmap-data/issues',
			{
				title: name,
				body: `Merchant name: ${name}
Country: ${country ? country : ''}
Address: ${address}
Lat: ${lat}
Long: ${long}
OSM: ${osm}
Category: ${category}
Payment methods: ${methods}
Twitter merchant: ${twitterMerchant}
Twitter submitter: ${twitterSubmitter}
Notes: ${notes}
Data Source: ${source}
Details (if applicable): ${sourceOther}
Contact: ${contact}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions).`,
				labels: country
					? ['good first issue', 'help wanted', 'location-submission', country]
					: ['good first issue', 'help wanted', 'location-submission']
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
