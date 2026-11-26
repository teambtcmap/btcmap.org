import crypto from "node:crypto";
import { isHttpError } from "@sveltejs/kit";
import type { AxiosResponse } from "axios";
import { AxiosError } from "axios";
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
		return isHttpError(e) ? e.status : 500;
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

	// #1681: Gitea refusing connections for a minute or two came out as a
	// bare 500, and people gave up instead of trying again
	describe("when Gitea fails", () => {
		const submit = (captcha: string) =>
			statusOf({
				...community,
				captchaSecret: encryptSecret(captcha),
				captchaTest: captcha,
			});

		const answered = (status: number) =>
			new AxiosError(
				`Request failed with status code ${status}`,
				"ERR_BAD_RESPONSE",
				undefined,
				undefined,
				{ status } as AxiosResponse,
			);

		it("answers 503 when Gitea can't be reached", async () => {
			vi.mocked(createIssueWithLabels).mockRejectedValue(
				new AxiosError("connect ECONNREFUSED", "ECONNREFUSED"),
			);
			expect(await submit("Refused")).toBe(503);
		});

		it("answers 503 when Gitea answers with a server error", async () => {
			vi.mocked(createIssueWithLabels).mockRejectedValue(answered(502));
			expect(await submit("BadGate")).toBe(503);
		});

		it("keeps a 500 when Gitea refuses the request itself", async () => {
			vi.mocked(createIssueWithLabels).mockRejectedValue(answered(422));
			expect(await submit("Refuses")).toBe(500);
		});

		it("keeps a 500 for a failure that isn't Gitea's", async () => {
			vi.mocked(createIssueWithLabels).mockRejectedValue(new Error("bug"));
			expect(await submit("OurBug1")).toBe(500);
		});
	});
});
