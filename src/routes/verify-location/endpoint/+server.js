import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import {
	GITHUB_API_KEY,
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR,
	OPENCAGE_API_KEY
} from '$env/static/private';
import { error } from '@sveltejs/kit';

axiosRetry(axios, { retries: 3 });

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
		location,
		edit,
		current,
		outdated,
		verified,
		lat,
		long
	} = await request.json();

	// if honey field has value return
	if (honey) {
		return;
	}

	// verify that captcha is correct
	/* eslint-disable no-undef */
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');
	/* eslint-enable no-undef */

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
Merchant location: ${location}
Edit link: ${edit}
Current information correct: ${current}
Outdated information: ${outdated}
How did you verify this?: ${verified}
Lat: ${lat}
Long: ${long}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions).`,
				labels: country
					? ['good first issue', 'help wanted', 'verify-submission', country]
					: ['good first issue', 'help wanted', 'verify-submission']
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
