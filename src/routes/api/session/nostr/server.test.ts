import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./+server";

// The handler only touches `request` (headers.get + json) and `fetch`, so we
// pass a minimal stub event and cast to the RequestHandler's arg type.
type PostEvent = Parameters<typeof POST>[0];

function makeRequest(opts: {
	contentLength?: string | null;
	json?: () => Promise<unknown>;
}): Request {
	const cl = opts.contentLength === undefined ? "100" : opts.contentLength;
	return {
		headers: {
			get: (name: string) =>
				name.toLowerCase() === "content-length" ? cl : null,
		},
		json:
			opts.json ?? (() => Promise.resolve({ signed_event: { kind: 27235 } })),
	} as unknown as Request;
}

function upstream(opts: {
	ok: boolean;
	status: number;
	json?: () => Promise<unknown>;
}): Response {
	return {
		ok: opts.ok,
		status: opts.status,
		json: opts.json ?? (() => Promise.resolve({})),
	} as unknown as Response;
}

const validBody = () =>
	Promise.resolve({ signed_event: { kind: 27235, sig: "x" } });

function call(request: Request, fetchImpl: unknown) {
	return POST({ request, fetch: fetchImpl } as unknown as PostEvent);
}

beforeEach(() => {
	// The error paths log to console.error by design; keep test output clean.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	// Restore the console.error spy so it can't leak into other test files.
	vi.restoreAllMocks();
});

describe("POST /api/session/nostr", () => {
	it("411 when Content-Length is missing", async () => {
		await expect(
			call(makeRequest({ contentLength: null }), vi.fn()),
		).rejects.toMatchObject({ status: 411 });
	});

	it("413 when Content-Length exceeds the cap", async () => {
		await expect(
			call(makeRequest({ contentLength: "5000" }), vi.fn()),
		).rejects.toMatchObject({ status: 413 });
	});

	it("413 when Content-Length is not a number", async () => {
		await expect(
			call(makeRequest({ contentLength: "abc" }), vi.fn()),
		).rejects.toMatchObject({ status: 413 });
	});

	it("400 on an invalid JSON body", async () => {
		await expect(
			call(
				makeRequest({ json: () => Promise.reject(new Error("bad")) }),
				vi.fn(),
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("400 when signed_event is missing", async () => {
		await expect(
			call(makeRequest({ json: () => Promise.resolve({}) }), vi.fn()),
		).rejects.toMatchObject({ status: 400 });
	});

	it("400 when signed_event is not an object", async () => {
		await expect(
			call(
				makeRequest({ json: () => Promise.resolve({ signed_event: "nope" }) }),
				vi.fn(),
			),
		).rejects.toMatchObject({ status: 400 });
	});

	it("401 when upstream returns 401", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(upstream({ ok: false, status: 401 }));
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 401 });
	});

	it("401 when upstream returns 403", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(upstream({ ok: false, status: 403 }));
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 401 });
	});

	it("502 when upstream throws (timeout/network)", async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});

	it("502 when upstream returns a non-2xx", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(upstream({ ok: false, status: 500 }));
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});

	it("502 when the upstream body is not valid JSON", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			upstream({
				ok: true,
				status: 200,
				json: () => Promise.reject(new Error("bad")),
			}),
		);
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});

	it("502 when upstream omits token/username/npub", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			upstream({
				ok: true,
				status: 200,
				json: () => Promise.resolve({ token: "t" }),
			}),
		);
		await expect(
			call(makeRequest({ json: validBody }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});

	it("returns token/username/npub on success and forwards Authorization: Nostr", async () => {
		const fetchImpl = vi.fn().mockResolvedValue(
			upstream({
				ok: true,
				status: 200,
				json: () =>
					Promise.resolve({
						token: "tok",
						username: "alice",
						npub: "npub1xyz",
					}),
			}),
		);
		const res = await call(makeRequest({ json: validBody }), fetchImpl);
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			token: "tok",
			username: "alice",
			npub: "npub1xyz",
		});

		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toContain("/v4/auth/nostr");
		expect(init.method).toBe("POST");
		expect(init.headers.Authorization).toMatch(/^Nostr /);
	});
});
