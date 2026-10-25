import { AxiosError, AxiosHeaders } from "axios";
import { readable } from "svelte/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trackEvent } from "#lib/analytics.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import type { SignerPairing } from "#lib/nostrSigner.js";
import { SignerInputError, SignerTimeoutError } from "#lib/nostrSigner.js";
import { errToast } from "#lib/utils.js";

import type { SignerDeps } from "./signerRun.svelte";
import { createSignerRun } from "./signerRun.svelte";

vi.mock("#lib/analytics.js", () => ({ trackEvent: vi.fn() }));
vi.mock("#lib/utils.js", () => ({ errToast: vi.fn() }));
vi.mock("#lib/i18n/index.js", () => ({
	_: readable((key: string) => `t:${key}`),
}));

const PUBKEY = "a".repeat(64);
const SIGNED = { pubkey: PUBKEY, sig: "s" } as unknown as SignedAuthEvent;
const PAIRING: SignerPairing = {
	v: 1,
	clientSecret: "c".repeat(64),
	bunkerUrl: "bunker://x",
	pubkey: PUBKEY,
	npub: null,
};

const deferred = <T>() => {
	let resolve: (value: T) => void = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
};

const signer = () => ({ close: vi.fn(async () => {}) });

const fakeDeps = (over: Partial<SignerDeps> = {}): SignerDeps => ({
	getNostrExtension: vi.fn(() => ({}) as never),
	signTemplateWithExtension: vi.fn(async () => SIGNED),
	decodeNsec: vi.fn(() => new Uint8Array([1, 2, 3])),
	signTemplateWithSecretKey: vi.fn(() => SIGNED),
	connectSavedPairing: vi.fn(async () => ({
		signer: signer() as never,
		pubkey: PUBKEY,
		pairing: PAIRING,
	})),
	connectBunkerUri: vi.fn(async () => ({
		signer: signer() as never,
		pubkey: PUBKEY,
		pairing: PAIRING,
	})),
	startNostrConnect: vi.fn(async () => ({
		signer: signer() as never,
		pubkey: PUBKEY,
		pairing: PAIRING,
	})),
	signWithSigner: vi.fn(async () => SIGNED),
	closeSigner: vi.fn(async () => {}),
	loadSignerPairing: vi.fn(() => PAIRING),
	saveSignerPairing: vi.fn(),
	clearSignerPairing: vi.fn(),
	...over,
});

const setup = (
	over: Partial<SignerDeps> = {},
	opts: { mode?: "login" | "link"; submit?: () => Promise<boolean> } = {},
) => {
	const deps = fakeDeps(over);
	const submit = vi.fn(opts.submit ?? (async () => true));
	const present = vi.fn();
	const onCancel = vi.fn();
	const onStart = vi.fn();
	const run = createSignerRun({
		mode: opts.mode ?? "login",
		template: () => ({ kind: 27235, created_at: 1, tags: [], content: "" }),
		submit,
		onStart,
		present,
		onCancel,
		openUrl: vi.fn(),
		deps,
	});
	return { run, deps, submit, present, onCancel, onStart };
};

const status = (code: number) =>
	new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
		status: code,
		statusText: "",
		data: {},
		headers: {},
		config: { headers: new AxiosHeaders() },
	});

beforeEach(() => {
	vi.clearAllMocks();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("saved pairing", () => {
	it("signs, submits, counts the success and keeps the pairing", async () => {
		const { run, deps, submit, onStart } = setup();
		run.restorePairing();

		await run.useSavedPairing();

		expect(onStart).toHaveBeenCalledOnce();
		expect(submit).toHaveBeenCalledWith(SIGNED, "saved");
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_saved_click", {
			method: "saved",
		});
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_success", {
			method: "saved",
		});
		expect(deps.saveSignerPairing).toHaveBeenCalledWith(PAIRING);
		expect(run.signerRun).toBeNull();
	});

	it("drops a pairing that can't be parsed", async () => {
		const { run, deps } = setup({
			connectSavedPairing: vi.fn(async () => {
				throw new SignerInputError("bad");
			}),
		});
		run.restorePairing();

		await run.useSavedPairing();

		expect(errToast).toHaveBeenCalledWith("t:login.bunkerInvalid");
		expect(deps.clearSignerPairing).toHaveBeenCalledOnce();
		expect(run.savedPairing).toBeNull();
	});
});

describe("cancel", () => {
	// A signer that answers after Cancel must not complete the action
	it("drops a signature that lands after cancel", async () => {
		const signing = deferred<SignedAuthEvent>();
		const { run, submit, onCancel } = setup({
			signWithSigner: vi.fn(() => signing.promise),
		});

		const pending = run.connectBunker("bunker://x");
		await vi.waitFor(() => expect(run.signerRun).toBe("bunker"));
		run.cancel();
		signing.resolve(SIGNED);

		expect(await pending).toBe(false);
		expect(submit).not.toHaveBeenCalled();
		expect(onCancel).toHaveBeenCalled();
		expect(run.signerRun).toBeNull();
	});

	it("drops an extension signature that lands after cancel", async () => {
		const signing = deferred<SignedAuthEvent>();
		const { run, submit } = setup({
			signTemplateWithExtension: vi.fn(() => signing.promise),
		});

		const pending = run.signWithExtension();
		expect(run.nostrLoading).toBe(true);
		run.cancel();
		signing.resolve(SIGNED);
		await pending;

		expect(submit).not.toHaveBeenCalled();
		expect(run.nostrLoading).toBe(false);
	});

	// The add-location login closes the panel on success (unmount ->
	// cancel) while submit is still running: the pairing is kept anyway
	it("keeps the pairing when the panel goes away during submit", async () => {
		const submitting = deferred<boolean>();
		const { run, deps } = setup({}, { submit: () => submitting.promise });

		const pending = run.connectBunker("bunker://x");
		await vi.waitFor(() => expect(deps.signWithSigner).toHaveBeenCalled());
		await Promise.resolve();
		run.cancel();
		submitting.resolve(true);
		await pending;

		expect(deps.saveSignerPairing).toHaveBeenCalledWith(PAIRING);
	});
});

describe("nostrconnect pairing", () => {
	it("presents the URI and switches presentation without a second session", async () => {
		const connecting = deferred<never>();
		const { run, deps, present } = setup({
			startNostrConnect: vi.fn(async ({ onUri }) => {
				onUri("nostrconnect://abc");
				return connecting.promise;
			}),
		});

		void run.startPairing("qr");
		await vi.waitFor(() => expect(run.connectUri).toBe("nostrconnect://abc"));
		expect(present).toHaveBeenLastCalledWith("nostrconnect://abc", "qr", 1);

		await run.startPairing("copy");
		expect(deps.startNostrConnect).toHaveBeenCalledOnce();
		expect(run.pairMode).toBe("copy");
		expect(present).toHaveBeenLastCalledWith("nostrconnect://abc", "copy", 1);
		run.cancel();
	});
});

describe("errors", () => {
	it("reads an API 401 as a rejected signature", async () => {
		const { run } = setup(
			{},
			{ submit: async () => Promise.reject(status(401)) },
		);

		await run.connectBunker("bunker://x");

		expect(errToast).toHaveBeenCalledWith("t:login.nostrFailed");
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_failure", {
			method: "bunker",
			status: 401,
		});
	});

	it("counts a signer that answers with an error as a signer failure of its surface", async () => {
		const { run } = setup(
			{
				startNostrConnect: vi.fn(async () => {
					throw new Error("user rejected");
				}),
			},
			{ mode: "link" },
		);

		await run.startPairing("qr");

		expect(trackEvent).toHaveBeenCalledWith("account_nostr_link_failure", {
			method: "qr",
			status: "signer",
		});
	});

	it("names a signer that never answered", async () => {
		const { run } = setup({
			connectBunkerUri: vi.fn(async () => {
				throw new SignerTimeoutError("no answer");
			}),
		});

		await run.connectBunker("bunker://x");

		expect(trackEvent).toHaveBeenCalledWith("login_nostr_failure", {
			method: "bunker",
			status: "timeout",
		});
	});

	it("counts no failure for a link whose session ended", async () => {
		const { SessionChangedError } = await import("#lib/authedApi.js");
		const { run } = setup(
			{},
			{
				mode: "link",
				submit: async () => Promise.reject(new SessionChangedError()),
			},
		);

		await run.connectBunker("bunker://x");

		expect(trackEvent).not.toHaveBeenCalledWith(
			"account_nostr_link_failure",
			expect.anything(),
		);
	});

	it("counts no failure for a run that was cancelled", async () => {
		const signing = deferred<SignedAuthEvent>();
		const { run, deps } = setup({
			signWithSigner: vi.fn(() => signing.promise),
		});

		// Cancel while the signer is signing, so the run's own await is
		// the one that sees the rejection
		const pending = run.connectBunker("bunker://x");
		await vi.waitFor(() => expect(deps.signWithSigner).toHaveBeenCalled());
		run.cancel();
		signing.reject(new Error("closed"));
		await pending;

		expect(trackEvent).not.toHaveBeenCalledWith(
			"login_nostr_failure",
			expect.anything(),
		);
	});

	// The login exchange's error carries the signed proof in its config
	it("logs an Axios failure's status, never the error", async () => {
		const offline = new AxiosError("Network Error", "ERR_NETWORK", {
			headers: new AxiosHeaders({ Authorization: "Nostr proof" }),
		});
		const { run } = setup({}, { submit: async () => Promise.reject(offline) });

		await run.connectBunker("bunker://x");

		expect(console.error).toHaveBeenCalledWith(
			"Nostr login failed:",
			"no response",
		);
	});

	it("names the surface's own error and carries the signer's reason", async () => {
		const { run } = setup(
			{
				connectBunkerUri: vi.fn(async () => {
					throw new Error("user rejected");
				}),
			},
			{ mode: "link" },
		);

		await run.connectBunker("bunker://x");

		expect(errToast).toHaveBeenCalledWith(
			"t:account.nostr.linkError (user rejected)",
		);
	});

	it("says so when the extension went away", async () => {
		const { run, submit } = setup({ getNostrExtension: vi.fn(() => null) });

		expect(await run.signWithExtension()).toBe(false);
		expect(errToast).toHaveBeenCalledWith("t:login.nostrNoExtension");
		expect(submit).not.toHaveBeenCalled();
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_failure", {
			method: "extension",
			status: "no_extension",
		});
	});
});

describe("secret key", () => {
	it("clears the field after decoding and zeroes the key after submit", async () => {
		const key = new Uint8Array([1, 2, 3]);
		const { run, submit } = setup({ decodeNsec: vi.fn(() => key) });
		const onDecoded = vi.fn();

		expect(await run.signWithNsec("nsec1x", onDecoded)).toBe(true);

		expect(onDecoded).toHaveBeenCalledOnce();
		expect(submit).toHaveBeenCalledWith(SIGNED, "nsec");
		expect([...key]).toEqual([0, 0, 0]);
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_success", {
			method: "nsec",
		});
	});

	it("keeps the field on a malformed key", async () => {
		const { run, submit } = setup({
			decodeNsec: vi.fn(() => {
				throw new Error("bad");
			}),
		});
		const onDecoded = vi.fn();

		await run.signWithNsec("nope", onDecoded);

		expect(errToast).toHaveBeenCalledWith("t:login.nsecInvalid");
		expect(onDecoded).not.toHaveBeenCalled();
		expect(submit).not.toHaveBeenCalled();
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_failure", {
			method: "nsec",
			status: "invalid",
		});
	});

	it("resolves false on a failed submit, for focus to go back", async () => {
		const { run } = setup(
			{},
			{ submit: async () => Promise.reject(status(500)) },
		);

		expect(await run.signWithNsec("nsec1x", () => {})).toBe(false);
		expect(errToast).toHaveBeenCalledWith("t:login.nostrError");
		expect(trackEvent).toHaveBeenCalledWith("login_nostr_failure", {
			method: "nsec",
			status: 500,
		});
	});
});
