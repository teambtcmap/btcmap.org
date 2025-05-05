import {
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR
} from '$env/static/private';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import { getAreaIdsByCoordinates } from '$lib/utils';
import { get } from 'svelte/store';
import { areas } from '$lib/store';
import { createIssueWithLabels } from '$lib/gitea';

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
		contact,
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

	const standardLabels = ['location-submission'];
	
	// Create filtered list of matched areas for reuse
	const associatedAreaIds = lat && long ? await getAreaIdsByCoordinates(lat, long) : [];
	const areasData = get(areas);
	const filteredAreas = associatedAreaIds
		.map(id => areasData.find(a => a.id === id))
		.filter(Boolean);

	const areaLabels = filteredAreas
		.map(area => area?.tags?.url_alias || area?.id)
		.filter((label): label is string => Boolean(label));
	const labels = [...standardLabels, ...areaLabels];

const body = `Merchant name: ${name}
Address: ${address}
Lat: ${lat}
Long: ${long}
Associated areas: ${filteredAreas.map(area => `${area?.tags.name} (${area?.tags?.url_alias || area?.id})`).join(', ')}
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

	const response = await createIssueWithLabels(name, body, labels);
	const gitea = response.data;

	return new Response(JSON.stringify(gitea));
};