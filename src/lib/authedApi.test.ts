import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authedClient, NotSignedInError } from "#lib/authedApi.js";
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
		});
	});

	it("uses an explicit token over the session's", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.delete).mockResolvedValue({ data: null });

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

	// A POST or PATCH that timed out may have landed; a retry would create a
	// second submission, note or photo
	it("turns retries off for POST and PATCH only", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.post).mockResolvedValue({ data: {} });
		vi.mocked(api.patch).mockResolvedValue({ data: {} });
		vi.mocked(api.put).mockResolvedValue({ data: {} });
		const client = authedClient();

		await client.post(URL, { a: 1 });
		await client.patch(URL, { a: 2 });
		await client.put(URL, { a: 3 });

		const noRetry = {
			headers: { Authorization: "Bearer tok" },
			"axios-retry": { retries: 0 },
		};
		expect(api.post).toHaveBeenCalledWith(URL, { a: 1 }, noRetry);
		expect(api.patch).toHaveBeenCalledWith(URL, { a: 2 }, noRetry);
		expect(api.put).toHaveBeenCalledWith(
			URL,
			{ a: 3 },
			{ headers: { Authorization: "Bearer tok" } },
		);
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
