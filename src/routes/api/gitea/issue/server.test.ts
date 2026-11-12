import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The real captcha validator runs: the keys below let the test mint secrets
vi.mock("$app/env/private", () => ({
	SERVER_CRYPTO_KEY: "aa".repeat(32),
	SERVER_INIT_VECTOR: "bb".repeat(16),
}));
vi.mock("#lib/gitea.js", () => ({
	createIssueWithLabels: vi.fn(),
}));
vi.mock("#lib/store.js", async () => {
	const { writable } = await import("svelte/store");
	return { areas: writable([]) };
});
vi.mock("#lib/utils.js", () => ({
	getAreaIdsByCoordinates: vi.fn(async () => []),
}));

import { GITEA_LABELS } from "#lib/constants.js";
import { createIssueWithLabels } from "#lib/gitea.js";

import { POST } from "./+server";

const encryptSecret = (text: string): string => {
	const key = Buffer.from("aa".repeat(32), "hex");
	const iv = Buffer.from("bb".repeat(16), "hex");
	const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
	return cipher.update(text, "utf8", "hex") + cipher.final("hex");
};

// Kit turns a thrown error() into its status and anything else into a 500
const statusOf = async (body: unknown): Promise<number> => {
	try {
		const response = await (
			POST as unknown as (event: unknown) => Promise<Response>
		)({
			request: new Request("http://localhost/api/gitea/issue", {
				method: "POST",
				body: JSON.stringify(body),
			}),
		});
		return response.status;
	} catch (e) {
		return (e as { status?: number }).status ?? 500;
	}
};

const community = {
	type: "verify-community",
	name: "Bitcoin Berlin",
	communityUrl: "https://btcmap.org/community/berlin",
	accurate: "yes",
	updates: "",
	verified: "Visited the meetup",
};

describe("POST /api/gitea/issue", () => {
	beforeEach(() => {
		vi.mocked(createIssueWithLabels).mockReset();
	});

	it("answers a filled honeypot with 418", async () => {
		expect(await statusOf({ ...community, honey: "bot" })).toBe(418);
	});

	it("rejects an unknown issue type with 400", async () => {
		expect(await statusOf({ ...community, type: "nope" })).toBe(400);
	});

	it("rejects a wrong captcha answer with 400", async () => {
		const captchaSecret = encryptSecret("Wrong01");
		expect(
			await statusOf({ ...community, captchaSecret, captchaTest: "other" }),
		).toBe(400);
	});

	// #1617: the answer is trimmed before comparing, so a missing or
	// non-string one must fail as a captcha 400, not crash into a 500
	it("rejects a missing captcha answer with 400", async () => {
		const captchaSecret = encryptSecret("Missing");
		expect(await statusOf({ ...community, captchaSecret })).toBe(400);
	});

	it("rejects a non-string captcha answer with 400", async () => {
		const captchaSecret = encryptSecret("NotText");
		expect(
			await statusOf({ ...community, captchaSecret, captchaTest: 1234567 }),
		).toBe(400);
	});

	it("files the issue on a right answer and returns it", async () => {
		vi.mocked(createIssueWithLabels).mockResolvedValue({
			data: { number: 42 },
		} as Awaited<ReturnType<typeof createIssueWithLabels>>);
		const captchaSecret = encryptSecret("RightOn");

		const response = await (
			POST as unknown as (event: unknown) => Promise<Response>
		)({
			request: new Request("http://localhost/api/gitea/issue", {
				method: "POST",
				body: JSON.stringify({
					...community,
					captchaSecret,
					captchaTest: "righton",
				}),
			}),
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ number: 42 });
		expect(createIssueWithLabels).toHaveBeenCalledWith(
			"Bitcoin Berlin",
			expect.stringContaining(
				"Community page: https://btcmap.org/community/berlin",
			),
			[GITEA_LABELS.DATA.VERIFY_COMMUNITY],
			"btcmap-data",
			[],
		);
	});
});
