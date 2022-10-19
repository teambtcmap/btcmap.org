import crypto from 'crypto';
import svgCaptcha from 'svg-captcha';
import { SERVER_CRYPTO_KEY, SERVER_INIT_VECTOR } from '$env/static/private';
import { error } from '@sveltejs/kit';

const initVector = Buffer.from(SERVER_INIT_VECTOR, 'hex');
const serverKey = Buffer.from(SERVER_CRYPTO_KEY, 'hex');

export const generate = () => {
	svgCaptcha.options.width = 275;
	svgCaptcha.options.height = 100;
	svgCaptcha.options.fontSize = 100;

	let captcha = svgCaptcha.create({ size: 7, noise: 2 });

	if (!captcha.data) {
		throw error(400, 'Could not generate captcha, please try again or contact BTC Map.');
	}

	let encrypt = crypto.createCipheriv('aes-256-cbc', serverKey, initVector);

	let secret = encrypt.update(captcha.text, 'utf8', 'hex');
	secret += encrypt.final('hex');

	return { captcha: captcha.data, captchaSecret: secret };
};

export const verify = (cipher, submission) => {
	let decrypt = crypto.createDecipheriv('aes-256-cbc', serverKey, initVector);

	let secret = decrypt.update(cipher, 'hex', 'utf8');
	secret += decrypt.final('utf8');

	if (submission !== secret) {
		throw error(400, 'Captcha test failed, please try again or contact BTC Map.');
	}
};
