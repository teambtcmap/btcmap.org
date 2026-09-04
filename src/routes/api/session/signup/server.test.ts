import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./+server";

// The handler only touches `request.json()` and `fetch`, so we pass a
// minimal stub event and cast to the RequestHandler's arg type.
type PostEvent = Parameters<typeof POST>[0];

function makeRequest(body: unknown): Request {
	return { json: () => Promise.resolve(body) } as unknown as Request;
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
		text: () => Promise.resolve(""),
	} as unknown as Response;
}

// Happy-path upstream: user creation echoes the requested name (or hands
// out a generated one), token creation returns a token.
function happyUpstream() {
	return vi
		.fn()
		.mockImplementation(async (url: string, init: { body: string }) => {
			if (url.endsWith("/v4/users")) {
				const sent = JSON.parse(init.body) as { name?: string };
				return upstream({
					ok: true,
					status: 201,
					json: () => Promise.resolve({ name: sent.name ?? "generated-name" }),
				});
			}
			return upstream({
				ok: true,
				status: 201,
				json: () => Promise.resolve({ token: "tok" }),
			});
		});
}

function call(request: Request, fetchImpl: unknown) {
	return POST({ request, fetch: fetchImpl } as unknown as PostEvent);
}

beforeEach(() => {
	// The error paths log to console.error by design; keep test output clean.
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("POST /api/session/signup", () => {
	it("400 on an invalid JSON body", async () => {
		const request = {
			json: () => Promise.reject(new Error("bad")),
		} as unknown as Request;
		await expect(call(request, vi.fn())).rejects.toMatchObject({
			status: 400,
		});
	});

	it("400 when password is missing", async () => {
		await expect(call(makeRequest({}), vi.fn())).rejects.toMatchObject({
			status: 400,
		});
	});

	it("400 when password exceeds 200 characters", async () => {
		const fetchImpl = vi.fn();
		await expect(
			call(makeRequest({ password: "x".repeat(201) }), fetchImpl),
		).rejects.toMatchObject({ status: 400 });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("400 when password is shorter than 8 characters", async () => {
		const fetchImpl = vi.fn();
		await expect(
			call(makeRequest({ password: "short7!" }), fetchImpl),
		).rejects.toMatchObject({ status: 400 });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("400 when name exceeds 100 characters", async () => {
		const fetchImpl = vi.fn();
		await expect(
			call(
				makeRequest({ name: "n".repeat(101), password: "correct-horse" }),
				fetchImpl,
			),
		).rejects.toMatchObject({ status: 400 });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("400 when name is not a string", async () => {
		const fetchImpl = vi.fn();
		await expect(
			call(makeRequest({ name: 42, password: "correct-horse" }), fetchImpl),
		).rejects.toMatchObject({ status: 400 });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it("creates a throwaway when name is omitted", async () => {
		const fetchImpl = happyUpstream();
		const res = await call(
			makeRequest({ password: "correct-horse" }),
			fetchImpl,
		);
		expect(await res.json()).toEqual({
			username: "generated-name",
			token: "tok",
		});

		const [url, init] = fetchImpl.mock.calls[0];
		expect(url).toContain("/v4/users");
		expect(JSON.parse(init.body)).toEqual({ password: "correct-horse" });
	});

	it("treats a blank name as omitted", async () => {
		const fetchImpl = happyUpstream();
		const res = await call(
			makeRequest({ name: "   ", password: "correct-horse" }),
			fetchImpl,
		);
		expect(await res.json()).toEqual({
			username: "generated-name",
			token: "tok",
		});
		expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
			password: "correct-horse",
		});
	});

	it("forwards a trimmed name and mints the token for it", async () => {
		const fetchImpl = happyUpstream();
		const res = await call(
			makeRequest({ name: "  alice  ", password: "correct-horse" }),
			fetchImpl,
		);
		expect(await res.json()).toEqual({ username: "alice", token: "tok" });

		expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
			name: "alice",
			password: "correct-horse",
		});
		const [tokenUrl, tokenInit] = fetchImpl.mock.calls[1];
		expect(tokenUrl).toContain("/v4/users/alice/tokens");
		expect(tokenInit.headers.Authorization).toBe("Bearer correct-horse");
	});

	it("502 when user creation throws (timeout/network)", async () => {
		const fetchImpl = vi.fn().mockRejectedValue(new Error("timeout"));
		await expect(
			call(makeRequest({ password: "correct-horse" }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});

	it("passes the upstream status through when user creation fails", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(upstream({ ok: false, status: 500 }));
		await expect(
			call(makeRequest({ password: "correct-horse" }), fetchImpl),
		).rejects.toMatchObject({ status: 500 });
	});

	it("502 when user creation returns no name", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValue(
				upstream({ ok: true, status: 201, json: () => Promise.resolve({}) }),
			);
		await expect(
			call(makeRequest({ password: "correct-horse" }), fetchImpl),
		).rejects.toMatchObject({ status: 502 });
	});
});
