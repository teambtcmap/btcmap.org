import type { BinaryLike, CipherKey } from "node:crypto";
import crypto from "node:crypto";
import { error } from "@sveltejs/kit";

import { env } from "$env/dynamic/private";

// TTL-based cache for used captcha secrets to prevent memory leaks
const CAPTCHA_TTL_MS = 10 * 60 * 1000; // 10 minutes
const usedCaptchas = new Map<string, number>();

function addUsedCaptcha(secret: string): void {
	usedCaptchas.set(secret, Date.now());
	// Clean up expired entries periodically
	if (usedCaptchas.size > 100) {
		const now = Date.now();
		for (const [key, timestamp] of usedCaptchas) {
			if (now - timestamp > CAPTCHA_TTL_MS) {
				usedCaptchas.delete(key);
			}
		}
	}
}

function isCaptchaUsed(secret: string): boolean {
	const timestamp = usedCaptchas.get(secret);
	if (!timestamp) return false;
	// Check if expired
	if (Date.now() - timestamp > CAPTCHA_TTL_MS) {
		usedCaptchas.delete(secret);
		return false;
	}
	return true;
}

export function validateCaptcha(
	captchaSecret: string,
	captchaTest: string,
): void {
	if (!env.SERVER_CRYPTO_KEY || !env.SERVER_INIT_VECTOR) {
		error(503, "Service unavailable");
	}

	const initVector = Buffer.from(env.SERVER_INIT_VECTOR, "hex");
	const serverKey = Buffer.from(env.SERVER_CRYPTO_KEY, "hex");

	const algorithm = "aes-256-cbc" as string;
	const key = serverKey as unknown as CipherKey;
	const iv = initVector as unknown as BinaryLike;
	const decrypt = crypto.createDecipheriv(algorithm, key, iv);

	let secret = decrypt.update(captchaSecret, "hex", "utf8");
	secret += decrypt.final("utf8");

	if (captchaTest !== secret) {
		error(400, "Captcha test failed, please try again or contact BTC Map.");
	}

	if (isCaptchaUsed(captchaSecret)) {
		error(400, "Captcha has already been used, please try another.");
	} else {
		addUsedCaptcha(captchaSecret);
	}
}
