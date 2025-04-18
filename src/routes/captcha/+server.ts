import { SERVER_CRYPTO_KEY, SERVER_INIT_VECTOR } from '$env/static/private';
import { error, json } from '@sveltejs/kit';
import crypto from 'crypto';
import svgCaptcha from 'svg-captcha';
import type { CipherKey, BinaryLike } from 'crypto';

// generate and return captcha
export function GET() {
	const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
	const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

	svgCaptcha.options.width = 275;
	svgCaptcha.options.height = 100;
	svgCaptcha.options.fontSize = 100;

	const captcha = svgCaptcha.create({ size: 7, noise: 2, color: true });

	if (!captcha.data) {
		error(400, 'Could not generate captcha, please try again or contact BTC Map.');
	}

	const algorithm = 'aes-256-cbc' as string;
	const key = serverKey as unknown as CipherKey;
	const iv = initVector as unknown as BinaryLike;
	const encrypt = crypto.createCipheriv(algorithm, key, iv);

	let secret = encrypt.update(captcha.text, 'utf8', 'hex');
	secret += encrypt.final('hex');

	return json({ captcha: captcha.data, captchaSecret: secret });
}
