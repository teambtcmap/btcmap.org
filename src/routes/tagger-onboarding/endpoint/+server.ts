import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import crypto from 'crypto';
import type { RequestHandler } from './$types';
import type { CipherKey, BinaryLike } from 'crypto';
import { createIssueWithLabels } from '$lib/gitea';

const used: string[] = [];

export const POST: RequestHandler = async ({ request }) => {
	const { captchaSecret, captchaTest, honey, name, email } = await request.json();

	if (honey) {
		error(418);
	}

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

	const labels = ['type/tagger-onboarding'];

	const body = `Name: ${name}
Email: ${email}
Created at: ${new Date(Date.now()).toISOString()}

New tagger onboarding request.`;

	const response = await createIssueWithLabels(name, body, labels);
	return new Response(JSON.stringify(response.data));
};
