import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import { createIssueWithLabels } from '$lib/gitea';
import { GITEA_LABELS } from '$lib/constants';

import type { CipherKey, BinaryLike } from 'crypto';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const {
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
		website,
		phone,
		hours,
		notes,
		source,
		sourceOther,
		contact
	} = await request.json();

	// if honey field has value return
	if (honey) {
		error(418);
	}

	// verify that captcha is correct
	if (!env.SERVER_CRYPTO_KEY || !env.SERVER_INIT_VECTOR) {
		error(503, 'Service unavailable');
	}
	const initVector = Buffer.from(env.SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(env.SERVER_CRYPTO_KEY, 'hex');

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

	const body = `Merchant name: ${name}
Address: ${address}
Lat: ${lat}
Long: ${long}
OSM: ${osm}
Category: ${category}
Payment methods: ${methods}
Website: ${website}
Phone: ${phone}
Opening hours: ${hours}
Notes: ${notes}
Data Source: ${source}
Details (if applicable): ${sourceOther}
Contact: ${contact}
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants).`;

	const response = await createIssueWithLabels(name, body, [GITEA_LABELS.DATA.ADD_LOCATION]);
	const gitea = response.data;

	return new Response(JSON.stringify(gitea));
};
