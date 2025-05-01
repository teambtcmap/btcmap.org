import {
	OPENCAGE_API_KEY,
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR
} from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import type { CipherKey, BinaryLike } from 'crypto';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const {
		captchaSecret,
		captchaTest,
		honey,
		name,
		location,
		edit,
		current,
		outdated,
		verified
	} = await request.json();

	// if honey field has value return
	if (honey) {
		error(418);
	}

	// verify that captcha is correct
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

	const algorithm = 'aes-256-cbc' as string;
	const key = serverKey as unknown as CipherKey;
	const iv = initVector as unknown as BinaryLike;
	const decrypt = crypto.createDecipheriv(algorithm, key, iv);

	let secret = decrypt.update(captchaSecret, 'hex', 'utf8');
	secret += decrypt.final('utf8');

	if (captchaTest !== secret) {
		error(400, 'Captcha test failed, please try again or contact BTC Map.');
	}

	if (used.includes(captchaSecret)) {
		error(400, 'Captcha has already been used, please try another.');
	} else {
		used.push(captchaSecret);
	}

	const country = await axios
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
			console.error(error);
		});

	const { createIssueWithLabels } = await import('$lib/gitea');

	const standardLabels = ['location-verification'];
	console.log('Received areas:', areas);
	const areaLabels = Array.isArray(areas) && areas.length > 0 ? areas : [];
	console.log('Processed area labels:', areaLabels);
	const labels = [...standardLabels, ...areaLabels];
	console.log('Final labels to be created:', labels);

	const body = `Merchant name: ${name}
Areas: ${areaLabels.length > 0 ? areaLabels.join(', ') : 'None'}
Merchant location: ${location}
Edit link: ${edit}
Current information correct: ${current}
Outdated information: ${outdated}
How did you verify this?: ${verified}
Lat: ${lat}
Long: ${long}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}
Areas: ${areaLabels.length > 0 ? areaLabels.join(', ') : 'None'}

If you are a new contributor please read our Tagging Instructions [here](https://wiki.btcmap.org/general/tagging-instructions.html).`;

	const response = await createIssueWithLabels(name, body, labels);
	const gitea = response.data;

	return new Response(JSON.stringify(gitea));
};