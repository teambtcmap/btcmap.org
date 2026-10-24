import { AxiosError, AxiosHeaders } from "axios";
import { get } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "#lib/analytics.js";
import { API_BASE } from "#lib/api-base.js";
import api from "#lib/axios.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import { NOSTR_AUTH_URL } from "#lib/nostr.js";

import { isLoginRefused, loginWithNostrEvent, loginWithPassword } from "./auth";
import { session } from "./session";

vi.mock("#lib/axios.js", () => ({
	default: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("#lib/analytics.js", () => ({ trackEvent: vi.fn() }));

const SIGNED = {
	id: "a".repeat(64),
	pubkey: "b".repeat(64),
	created_at: 1,
	kind: 27235,
	tags: [],
	content: "",
	sig: "c".repeat(128),
} as SignedAuthEvent;

const status = (code: number) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status: code,
		statusText: "",
		data: {},
		headers: {},
		config: { headers: new AxiosHeaders() },
	});

const savedLists = () =>
	vi.mocked(api.get).mockImplementation(async (url) => ({
		data: url.includes("places") ? [{ id: 4 }] : [{ id: 8 }],
	}));

beforeEach(() => {
	vi.clearAllMocks();
	localStorage.clear();
	session.login("someone", "old");
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loginWithPassword", () => {
	it("mints a token, signs in, loads the saved items and counts the login", async () => {
		vi.mocked(api.post).mockResolvedValue({ data: { token: "tok" } });
		savedLists();

		const login = await loginWithPassword(" alice ", "pw");

		expect(api.post).toHaveBeenCalledWith(
			`${API_BASE}/v4/users/alice/tokens`,
			{ label: "BTC Map Web" },
			{ headers: { Authorization: "Bearer pw" } },
		);
		expect(login.session).toMatchObject({ username: "alice", token: "tok" });
		expect(trackEvent).toHaveBeenCalledWith("login_password_success");

		expect(await login.savedItems).toEqual({ place: true, area: true });
		expect(get(session)).toMatchObject({ savedPlaces: [4], savedAreas: [8] });
	});

	it("leaves the session alone when the mint is refused", async () => {
		vi.mocked(api.post).mockRejectedValue(status(401));

		const error = await loginWithPassword("alice", "nope").catch((e) => e);

		expect(isLoginRefused(error)).toBe(true);
		expect(get(session)?.username).toBe("someone");
		expect(trackEvent).not.toHaveBeenCalled();
	});

	// The account exists and the token works: a failed load must not turn
	// the login into an error
	it("still logs in when the saved items fail to load", async () => {
		vi.mocked(api.post).mockResolvedValue({ data: { token: "tok" } });
		vi.mocked(api.get).mockRejectedValue(new Error("offline"));

		const login = await loginWithPassword("alice", "pw");

		expect(get(session)?.token).toBe("tok");
		expect(await login.savedItems).toEqual({ place: false, area: false });
	});
});

describe("loginWithNostrEvent", () => {
	it("exchanges the signed event and keeps the npub on the session", async () => {
		vi.mocked(api.post).mockResolvedValue({
			data: { token: "ntok", username: "nostr-user", npub: "npub1x" },
		});
		savedLists();

		const login = await loginWithNostrEvent(SIGNED);

		const [url, body, config] = vi.mocked(api.post).mock.calls[0];
		expect(url).toBe(NOSTR_AUTH_URL);
		expect(body).toBeUndefined();
		expect(config?.headers?.Authorization).toMatch(/^Nostr /);
		expect(login.session).toMatchObject({
			username: "nostr-user",
			token: "ntok",
			npub: "npub1x",
		});
		await login.savedItems;
		expect(get(session)?.savedPlaces).toEqual([4]);
	});

	it("rejects a response without a token, leaving the session alone", async () => {
		vi.mocked(api.post).mockResolvedValue({ data: "<html>" });

		await expect(loginWithNostrEvent(SIGNED)).rejects.toThrow();
		expect(get(session)?.username).toBe("someone");
	});
});

describe("isLoginRefused", () => {
	it("is true for 401 and 403 only", () => {
		expect(isLoginRefused(status(401))).toBe(true);
		expect(isLoginRefused(status(403))).toBe(true);
		expect(isLoginRefused(status(500))).toBe(false);
		expect(isLoginRefused(new Error("offline"))).toBe(false);
	});
});
