import {
	SERVER_CRYPTO_KEY,
	SERVER_INIT_VECTOR
} from '$env/static/private';
import { error } from '@sveltejs/kit';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import type { CipherKey, BinaryLike } from 'crypto';
import { getAreasByCoordinates } from '$lib/utils';
import { createIssueWithLabels } from '$lib/gitea';

export const POST: RequestHandler = async ({ request }) => {
	console.log('Verify location POST endpoint called');
	const {
		captchaSecret,
		captchaTest,
		honey,
		name,
		location,
		edit,
		current,
		outdated,
		verified,
		merchantId,
		lat,
		long
	} = await request.json();
	
	console.log('Request data:', { 
		name, 
		location, 
		current, 
		outdated,
		merchantId 
	});

	if (honey) {
		error(418);
	}

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

	const standardLabels = ['location-verification'];
	const areaData = lat && long ? getAreasByCoordinates(lat, long) : [];
	console.log('Area data for coordinates:', {lat, long}, areaData); // Debug log
	const areaLabels = areaData.map(([id, alias]) => alias || id).filter(Boolean);
	const allLabels = [...standardLabels, ...areaLabels];

	// Format areas for the issue body
	const areasFormatted = areaData.map(([id, alias, type]) => 
		`${alias || id}${type ? ` (${type})` : ''}`
	).join(', ');

	const body = `Merchant name: ${name}
Areas: ${areasFormatted || 'None'}
Merchant location: ${location}
Coordinates: ${lat}, ${long}
Edit link: ${edit}
Current information correct: ${current}
Outdated information: ${outdated}
How did you verify this?: ${verified}
Status: Todo
Created at: ${new Date(Date.now()).toISOString()}

If you are a new contributor please read our Tagging Instructions [here](https://wiki.btcmap.org/general/tagging-instructions.html).`;

	const response = await createIssueWithLabels(name, body, allLabels);
	return new Response(JSON.stringify(response.data));
};