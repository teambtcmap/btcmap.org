import { describe, expect, it, vi } from "vitest";

vi.mock("$app/env/private", () => ({
	BTCMAP_IMPORT_TOKEN: "import-token",
}));
vi.mock("#lib/server/captcha.js", () => ({
	validateCaptcha: vi.fn(),
}));

import { POST } from "./+server";

const call = (body: unknown, fetchImpl: unknown) =>
	(POST as unknown as (event: unknown) => Promise<Response>)({
		request: new Request("http://localhost/api/submit-place", {
			method: "POST",
			body: JSON.stringify(body),
		}),
		fetch: fetchImpl,
	});

const validBody = {
	captchaSecret: "secret",
	captchaTest: "answer",
	name: "Satoshi's Comics",
	category: "shop",
	lat: 52.48841,
	long: 13.42986,
	methods: ["onchain"],
	contact: "owner@example.com",
};

const rpcOk = () =>
	vi.fn().mockResolvedValue(
		new Response(JSON.stringify({ jsonrpc: "2.0", result: { id: 7 } }), {
			status: 200,
		}),
	);

describe("POST /api/submit-place", () => {
	it("submits anonymously via RPC and returns only the id", async () => {
		const fetchImpl = rpcOk();
		const res = await call(validBody, fetchImpl);

		// No attributed flag any more — the proxy is anonymous-only (#1374).
		expect(await res.json()).toEqual({ id: 7 });

		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
		expect(url).toMatch(/\/rpc$/);
		expect((init.headers as Record<string, string>).Authorization).toBe(
			"Bearer import-token",
		);
		const rpc = JSON.parse(init.body as string);
		expect(rpc.method).toBe("submit_place");
		expect(rpc.params.extra_fields.contact).toBe("owner@example.com");
	});

	it("rejects a missing contact", async () => {
		await expect(
			call({ ...validBody, contact: "" }, rpcOk()),
		).rejects.toMatchObject({ status: 400 });
	});

	it("teapots the honeypot", async () => {
		await expect(
			call({ ...validBody, honey: "sticky" }, rpcOk()),
		).rejects.toMatchObject({ status: 418 });
	});

	it("rejects invalid coordinates", async () => {
		await expect(
			call({ ...validBody, lat: "52" }, rpcOk()),
		).rejects.toMatchObject({ status: 400 });
	});
});
