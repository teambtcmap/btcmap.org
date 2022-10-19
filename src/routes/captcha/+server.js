import { json } from '@sveltejs/kit';
import { generate } from '$lib/captcha';

// generate and return captcha
export function GET() {
	let captcha = generate();
	return json(captcha);
}
