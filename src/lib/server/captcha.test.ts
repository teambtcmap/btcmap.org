import { vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({
	env: {
		SERVER_CRYPTO_KEY: "aa".repeat(32),
		SERVER_INIT_VECTOR: "bb".repeat(16),
	},
}));

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

	it("rejects a reused secret with 400", () => {
		const secret = encryptSecret("ABC14");
		expect(caughtStatus(() => validateCaptcha(secret, "ABC14"))).toBeNull();
		expect(caughtStatus(() => validateCaptcha(secret, "ABC14"))).toBe(400);
	});
});
