import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	authedClient,
	NotSignedInError,
	SessionChangedError,
} from "#lib/authedApi.js";
import { session } from "#lib/session.js";

vi.mock("#lib/axios.js", () => ({
	default: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
		patch: vi.fn(),
		delete: vi.fn(),
	},
}));

const URL = "https://api.example/v4/thing";

// A rejection the way axios builds it: the request config, credentials and
// body included, on the error and on its response
const failedRequest = (headers: Record<string, string>, data: unknown) => {
	const config = { headers: new AxiosHeaders(headers), data };
	return new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, {
		status: 500,
		statusText: "",
		data: { code: "server_error", message: "boom" },
		headers: {},
		config,
	});
};

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	session.login("alice", "tok");
});

describe("authedClient", () => {
	it("sends the session's token as the Bearer, keeping the caller's config", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: [1] });

		const res = await authedClient().get(URL, { params: { limit: 5 } });

		expect(res.data).toEqual([1]);
		expect(api.get).toHaveBeenCalledWith(URL, {
			params: { limit: 5 },
			headers: { Authorization: "Bearer tok" },
		});
	});

	it("merges the caller's headers with the Bearer", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: {} });

		await authedClient().put(URL, undefined, {
			headers: { "X-Nostr-Authorization": "Nostr proof" },
		});

		expect(api.put).toHaveBeenCalledWith(URL, undefined, {
			headers: {
				"X-Nostr-Authorization": "Nostr proof",
				Authorization: "Bearer tok",
			},
			"axios-retry": { retries: 0 },
		});
	});

	it("uses an explicit token over the session's", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.delete).mockResolvedValue({ data: null });

		// It follows its caller's own session store, not this one
		session.login("bob", "tok2");
		await authedClient("other").delete(URL);

		expect(api.delete).toHaveBeenCalledWith(URL, {
			headers: { Authorization: "Bearer other" },
		});
	});

	it("throws NotSignedInError without a session, sending nothing", async () => {
		const { default: api } = await import("#lib/axios.js");
		await session.logout();
		vi.clearAllMocks();

		expect(() => authedClient()).toThrow(NotSignedInError);
		expect(api.get).not.toHaveBeenCalled();
	});

	// A POST or PATCH that timed out may have landed (a second note or
	// photo); the account PUTs would resend credentials
	it("retries only reads and deletes", async () => {
		const { default: api } = await import("#lib/axios.js");
		for (const method of ["get", "delete", "post", "put", "patch"] as const) {
			vi.mocked(api[method]).mockResolvedValue({ data: {} });
		}
		const client = authedClient();

		await client.get(URL);
		await client.delete(URL);
		await client.post(URL, { a: 1 });
		await client.put(URL, { a: 2 });
		await client.patch(URL, { a: 3 });

		const retry = { headers: { Authorization: "Bearer tok" } };
		const noRetry = { ...retry, "axios-retry": { retries: 0 } };
		expect(api.get).toHaveBeenCalledWith(URL, retry);
		expect(api.delete).toHaveBeenCalledWith(URL, retry);
		expect(api.post).toHaveBeenCalledWith(URL, { a: 1 }, noRetry);
		expect(api.put).toHaveBeenCalledWith(URL, { a: 2 }, noRetry);
		expect(api.patch).toHaveBeenCalledWith(URL, { a: 3 }, noRetry);
	});

	// A logout whose revoke failed leaves the token working: a late Undo
	// must not delete the previous user's photos
	it("sends nothing once its session has ended", async () => {
		const { default: api } = await import("#lib/axios.js");
		const client = authedClient();
		session.login("bob", "tok2");
		vi.clearAllMocks();

		await expect(client.delete(URL)).rejects.toBeInstanceOf(
			SessionChangedError,
		);
		expect(api.delete).not.toHaveBeenCalled();
	});

	it("rejects with the credentials and the body scrubbed from the error", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(
			failedRequest(
				{
					Authorization: "Bearer tok",
					"X-Nostr-Authorization": "Nostr proof",
					Accept: "application/json",
				},
				'{"old_password":"hunter2"}',
			),
		);

		const error = await authedClient()
			.put(URL, { old_password: "hunter2" })
			.catch((e: unknown) => e);

		expect(error).toBeInstanceOf(AxiosError);
		const logged = JSON.stringify((error as AxiosError).toJSON());
		expect(logged).not.toContain("tok");
		expect(logged).not.toContain("proof");
		expect(logged).not.toContain("hunter2");
		// What callers read stays: the status and the API's message
		expect((error as AxiosError).response?.status).toBe(500);
		expect((error as AxiosError).response?.data).toEqual({
			code: "server_error",
			message: "boom",
		});
		expect((error as AxiosError).config?.headers.get("Accept")).toBe(
			"application/json",
		);
	});

	// A plain-object config (one axios hasn't normalized) can carry any
	// casing; the transport's request object keeps raw headers in Node
	it("scrubs any casing of the credential headers, and the request object", async () => {
		const { default: api } = await import("#lib/axios.js");
		const error = new AxiosError(
			"Request failed",
			"ERR_NETWORK",
			{
				headers: { authorization: "Bearer tok", Accept: "json" },
			} as never,
			{ _header: "GET / HTTP/1.1\r\nAuthorization: Bearer tok" },
		);
		vi.mocked(api.get).mockRejectedValue(error);

		const caught = (await authedClient()
			.get(URL)
			.catch((e: unknown) => e)) as AxiosError;

		expect(caught.request).toBeUndefined();
		expect(caught.config?.headers).toEqual({ Accept: "json" });
		expect(JSON.stringify(caught.toJSON())).not.toContain("tok");
	});

	it("passes a non-Axios failure through unchanged", async () => {
		const { default: api } = await import("#lib/axios.js");
		const failure = new Error("offline");
		vi.mocked(api.get).mockRejectedValue(failure);

		await expect(authedClient().get(URL)).rejects.toBe(failure);
	});

	it("stays current until a logout or another login", async () => {
		const client = authedClient();
		expect(client.stillCurrent()).toBe(true);

		session.login("bob", "tok2");
		expect(client.stillCurrent()).toBe(false);
		expect(authedClient().stillCurrent()).toBe(true);

		await session.logout();
		expect(client.stillCurrent()).toBe(false);
	});
});
