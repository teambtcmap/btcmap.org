import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASE } from "#lib/api-base.js";

import {
	changePassword,
	changeUsername,
	fetchLinkedNpub,
	linkNostr,
	unlinkNostr,
} from "./account";

vi.mock("#lib/axios.js", () => ({
	default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const AUTH = { headers: { Authorization: "Bearer tok" } };

// What btcmap-api's RestApiError sends: { code, message } with the status
const apiError = (status: number, message: string) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status,
		statusText: "",
		data: { code: "invalid_input", message },
		headers: {},
		config: { headers: new AxiosHeaders() },
	});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("changeUsername", () => {
	it("sends the new name and returns the name the API stored", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: { id: 1, name: "alice" } });

		expect(await changeUsername("tok", "alice")).toEqual({
			status: "changed",
			username: "alice",
		});
		expect(api.put).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/me/username`,
			{ username: "alice" },
			AUTH,
		);
	});

	it("reads a 500 as a taken name", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(
			apiError(500, "Database query failed"),
		);

		expect(await changeUsername("tok", "bob")).toEqual({ status: "taken" });
	});

	it("rethrows other failures", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(apiError(401, "Unauthorized"));

		await expect(changeUsername("tok", "bob")).rejects.toThrow();
	});

	it("throws when the response carries no name", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: {} });

		await expect(changeUsername("tok", "bob")).rejects.toThrow();
	});
});

describe("changePassword", () => {
	it("sends the current and the new password", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: null });

		expect(await changePassword("tok", "old pw", "new password")).toBe(
			"changed",
		);
		expect(api.put).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/me/password`,
			{ old_password: "old pw", new_password: "new password" },
			AUTH,
		);
	});

	it("reports a wrong current password", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(apiError(400, "Invalid old password"));

		expect(await changePassword("tok", "nope", "new password")).toBe(
			"wrongPassword",
		);
	});

	it("reports an account without a password (created with Nostr)", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(
			apiError(400, "Invalid password hash"),
		);

		expect(await changePassword("tok", "", "new password")).toBe("noPassword");
	});

	it("rethrows other failures", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(new Error("offline"));

		await expect(changePassword("tok", "a", "b")).rejects.toThrow("offline");
	});
});

describe("fetchLinkedNpub", () => {
	it("returns the linked npub", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { npub: "npub1abc" } });

		expect(await fetchLinkedNpub("tok")).toBe("npub1abc");
		expect(api.get).toHaveBeenCalledWith(`${API_BASE}/v4/users/me/nostr`, AUTH);
	});

	it("returns null when nothing is linked", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.get).mockResolvedValue({ data: { npub: null } });

		expect(await fetchLinkedNpub("tok")).toBeNull();
	});
});

describe("linkNostr", () => {
	const proof = "base64-event";

	it("sends the Bearer token and the NIP-98 proof, without a body", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: { npub: "npub1abc" } });

		expect(await linkNostr("tok", proof)).toEqual({
			status: "linked",
			npub: "npub1abc",
		});
		expect(api.put).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/me/nostr`,
			undefined,
			{
				headers: {
					Authorization: "Bearer tok",
					"X-Nostr-Authorization": "Nostr base64-event",
				},
			},
		);
	});

	it("reports a key linked to another account", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(
			apiError(400, "npub already linked to another account"),
		);

		expect(await linkNostr("tok", proof)).toEqual({ status: "taken" });
	});

	it("rethrows a rejected proof", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockRejectedValue(apiError(401, "Unauthorized"));

		await expect(linkNostr("tok", proof)).rejects.toThrow();
	});

	it("throws when the response carries no npub", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.put).mockResolvedValue({ data: { npub: null } });

		await expect(linkNostr("tok", proof)).rejects.toThrow();
	});
});

describe("unlinkNostr", () => {
	it("deletes the link with the Bearer token", async () => {
		const { default: api } = await import("#lib/axios.js");
		vi.mocked(api.delete).mockResolvedValue({ data: { npub: null } });

		await unlinkNostr("tok");
		expect(api.delete).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/me/nostr`,
			AUTH,
		);
	});
});
