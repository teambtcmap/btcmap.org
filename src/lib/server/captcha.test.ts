import { vi } from "vitest";

// Mutable so individual tests can simulate misconfiguration; vi.hoisted
// runs before the hoisted vi.mock factory below.
const mockEnv = vi.hoisted(() => ({
	SERVER_CRYPTO_KEY: "aa".repeat(32),
	SERVER_INIT_VECTOR: "bb".repeat(16),
}));

vi.mock("$env/dynamic/private", () => ({ env: mockEnv }));

import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import { validateCaptcha } from "./captcha";

const encryptSecret = (text: string): string => {
	const key = Buffer.from("aa".repeat(32), "hex");
	const iv = Buffer.from("bb".repeat(16), "hex");
	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
	let out = cipher.update(text, "utf8", "hex");
	out += cipher.final("hex");
	return out;
};

const caughtStatus = (fn: () => void): number | null => {
	try {
		fn();
		return null;
	} catch (e) {
		return (e as { status: number }).status;
	}
};

describe("validateCaptcha", () => {
	it("accepts the matching answer", () => {
		const secret = encryptSecret("ABC12");
		expect(caughtStatus(() => validateCaptcha(secret, "ABC12"))).toBeNull();
	});

	it("rejects a wrong answer with 400", () => {
		const secret = encryptSecret("ABC13");
		expect(caughtStatus(() => validateCaptcha(secret, "nope"))).toBe(400);
	});

	it("rejects garbage ciphertext with 400 instead of throwing", () => {
		// decrypt.final() throws on bad padding ("00") and non-hex input
		// ("zz") — both must surface as the captcha 400, not a 500.
		expect(caughtStatus(() => validateCaptcha("00", "x"))).toBe(400);
		expect(caughtStatus(() => validateCaptcha("zz", ""))).toBe(400);
	});

	it("rejects a reused secret with 400", () => {
		const secret = encryptSecret("ABC14");
		expect(caughtStatus(() => validateCaptcha(secret, "ABC14"))).toBeNull();
		expect(caughtStatus(() => validateCaptcha(secret, "ABC14"))).toBe(400);
	});

	it("reports a malformed server key as 503, not a captcha 400", () => {
		// Hex typos silently truncate on decode — wrong length must read as
		// misconfiguration, never blamed on the user's captcha answer.
		const secret = encryptSecret("ABC15");
		mockEnv.SERVER_CRYPTO_KEY = "aa".repeat(31);
		try {
			expect(caughtStatus(() => validateCaptcha(secret, "ABC15"))).toBe(503);
		} finally {
			mockEnv.SERVER_CRYPTO_KEY = "aa".repeat(32);
		}
	});
});
