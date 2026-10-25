import { isAxiosError } from "axios";
import type { EventTemplate } from "nostr-tools/pure";
import { get } from "svelte/store";

import type { EventName, NostrSignMethod } from "#lib/analytics.js";
import { trackEvent } from "#lib/analytics.js";
import { errorStatus, failureStatus } from "#lib/apiError.js";
import { _ } from "#lib/i18n/index.js";
import type { SignedAuthEvent } from "#lib/nostr.js";
import {
	decodeNsec,
	getNostrExtension,
	signTemplateWithExtension,
	signTemplateWithSecretKey,
} from "#lib/nostr.js";
import type {
	Closable,
	SignerPairing,
	SignerSession,
} from "#lib/nostrSigner.js";
import {
	classifySignerError,
	clearSignerPairing,
	closeSigner,
	connectBunkerUri,
	connectSavedPairing,
	hasErrorName,
	loadSignerPairing,
	pairingWithSignerKey,
	saveSignerPairing,
	signWithSigner,
	startNostrConnect,
} from "#lib/nostrSigner.js";
import { safeHttpUrl } from "#lib/safeUrl.js";
import { errToast } from "#lib/utils.js";

// One attempt at signing a NIP-98 event with the user's key and handing it to
// the caller, by any transport: browser extension, secret key, a saved signer
// pairing, a bunker URI, or a NostrConnect pairing (QR / app hand-off / copy).
// NostrAuthMethods renders it; this owns the run: which transport is busy,
// cancelling, dropping stale results, saving the pairing that worked, and
// turning failures into the panel's toasts and the funnel's events.
//
// Stale results are the danger here: a signer that answers after Cancel must
// not complete the action. Every run captures the generation, and any await
// that comes back with a stale one is dropped (and its signer closed).

export type SignerMode = "login" | "link";
// Which signer transport is running. "qr", "open" and "copy" share one
// nostrconnect session; the presentation only decides how its URI is shown.
export type PairMode = "qr" | "open" | "copy";
export type SignerRunKind = "saved" | "bunker" | PairMode;

// Each surface owns its funnel, its toast and its log label: the
// transports are the same, the words not. Failure logs name the surface; an
// API error object never gets logged (an Axios error carries the Bearer
// token and the request body).
const MODES = {
	login: {
		events: {
			toggle: "login_nostr_options_toggle",
			extension: "login_nostr_extension_click",
			nsec: "login_nostr_nsec_click",
			bunker: "login_nostr_bunker_click",
			saved: "login_nostr_saved_click",
			forget: "login_nostr_forget_click",
			qr: "login_nostr_connect_qr_click",
			open: "login_nostr_connect_open_click",
			copy: "login_nostr_connect_copy_click",
			authUrl: "login_nostr_auth_url_click",
			success: "login_nostr_success",
			failure: "login_nostr_failure",
		},
		errorKey: "login.nostrError",
		logLabel: "Nostr login failed:",
	},
	link: {
		events: {
			toggle: "account_nostr_options_toggle",
			extension: "account_nostr_link_click",
			nsec: "account_nostr_link_click",
			bunker: "account_nostr_link_click",
			saved: "account_nostr_link_click",
			forget: "account_nostr_forget_click",
			qr: "account_nostr_link_click",
			open: "account_nostr_link_click",
			copy: "account_nostr_link_click",
			authUrl: "account_nostr_auth_url_click",
			success: "account_nostr_link_success",
			failure: "account_nostr_link_failure",
		},
		errorKey: "account.nostr.linkError",
		logLabel: "Nostr key link failed:",
	},
} as const satisfies Record<
	SignerMode,
	{ events: Record<string, EventName>; errorKey: string; logLabel: string }
>;

// What a failure may log: an HTTP error's status, never the error itself.
// The login exchange's Axios error isn't scrubbed (it isn't an authedApi
// call) and carries the signed proof in its request config, also when no
// response came back.
const loggable = (err: unknown) =>
	isAxiosError(err) ? (errorStatus(err) ?? "no response") : err;

// The transports, as one adapter: the real ones by default, fakes in tests.
export type SignerDeps = {
	getNostrExtension: typeof getNostrExtension;
	signTemplateWithExtension: typeof signTemplateWithExtension;
	decodeNsec: typeof decodeNsec;
	signTemplateWithSecretKey: typeof signTemplateWithSecretKey;
	connectSavedPairing: typeof connectSavedPairing;
	connectBunkerUri: typeof connectBunkerUri;
	startNostrConnect: typeof startNostrConnect;
	signWithSigner: typeof signWithSigner;
	closeSigner: typeof closeSigner;
	loadSignerPairing: typeof loadSignerPairing;
	saveSignerPairing: typeof saveSignerPairing;
	clearSignerPairing: typeof clearSignerPairing;
};

export const nostrSignerDeps: SignerDeps = {
	getNostrExtension,
	signTemplateWithExtension,
	decodeNsec,
	signTemplateWithSecretKey,
	connectSavedPairing,
	connectBunkerUri,
	startNostrConnect,
	signWithSigner,
	closeSigner,
	loadSignerPairing,
	saveSignerPairing,
	clearSignerPairing,
};

type Options = {
	mode: SignerMode;
	// The NIP-98 template to sign, built at signing time (the API's
	// created_at window is +/-60s and connecting a signer can take minutes).
	template: () => EventTemplate;
	// Submit the signed event (exchange it for a session, link the key).
	// Resolves false when the caller already told the user why it was
	// refused — no success event, no pairing saved. `method` is for the
	// caller's own failure event on such a refusal.
	submit: (event: SignedAuthEvent, method: NostrSignMethod) => Promise<boolean>;
	// Called before a transport starts signing: a caller that binds the
	// signature to something (the account being linked) snapshots it there,
	// before any await can outlive it.
	onStart?: () => void;
	// Show a NostrConnect URI the way `presentation` asks (QR canvas, app
	// hand-off, clipboard). `run` lets a delayed effect check isCurrent.
	present: (uri: string, presentation: PairMode, run: number) => void;
	// The run was abandoned: clear what the presentation put on screen.
	onCancel?: () => void;
	// The signer's approval page, already checked to be http(s).
	openUrl?: (url: string) => void;
	deps?: SignerDeps;
};

export const createSignerRun = ({
	mode,
	template,
	submit,
	onStart,
	present,
	onCancel,
	openUrl = (url) => window.open(url, "_blank", "noopener,noreferrer"),
	deps = nostrSignerDeps,
}: Options) => {
	const { events, errorKey, logLabel } = MODES[mode];
	const t = (key: string) => get(_)(key);

	let nostrLoading = $state(false);
	let nsecLoading = $state(false);
	let signerRun = $state<SignerRunKind | null>(null);
	// The signer's approval page, offered as a real link: auth_url arrives
	// over the relay long after the click that started the run, so a
	// window.open() here is outside the user-activation window and Safari
	// (and sometimes Chromium) blocks it without telling us.
	let authUrl = $state<string | null>(null);
	let pairMode = $state<PairMode | null>(null);
	let connectUri = $state<string | null>(null);
	let savedPairing = $state<SignerPairing | null>(null);

	let generation = 0;
	let abortController: AbortController | null = null;
	let activeSigner: Closable | null = null;

	const anyLoading = () => nostrLoading || nsecLoading || signerRun !== null;

	// A 401/403 means the API rejected the signature, not that the
	// transport broke. An API failure logs its status, never the error; a
	// transport failure (extension refused, relay dead) has nothing to leak.
	const showError = (err: unknown, logLabel: string) => {
		const status = errorStatus(err);
		errToast(
			status === 401 || status === 403 ? t("login.nostrFailed") : t(errorKey),
		);
		console.error(logLabel, loggable(err));
	};

	// The funnel's failure event: only for a run that is still current, so
	// a cancel or a newer run never counts as one
	const trackFailure = (method: NostrSignMethod, err: unknown) =>
		trackEvent(events.failure, { method, status: failureStatus(err) });

	const failSigner = (err: unknown, run: number, method: SignerRunKind) => {
		if (run !== generation || hasErrorName(err, "AbortError")) return;
		trackFailure(method, err);
		cancel();
		// An API rejection is the same failure the other transports report, so
		// it gets the same "signature rejected" wording rather than a signer
		// message.
		if (errorStatus(err) !== undefined) {
			showError(err, logLabel);
			return;
		}
		switch (classifySignerError(err)) {
			case "invalid":
				errToast(t("login.bunkerInvalid"));
				return;
			case "timeout":
				errToast(t("login.signerNoAnswer"));
				return;
			case "relay":
				errToast(t("login.signerNoRelay"));
				return;
			default: {
				// A signer that refuses says why ("already connected", "user
				// rejected", …); that text is the only clue the user has, so it
				// rides along with the generic message.
				const detail =
					typeof err === "string" ? err : (err as Error | undefined)?.message;
				const message = t(errorKey);
				errToast(detail ? `${message} (${detail})` : message);
				console.error(logLabel, loggable(err));
			}
		}
	};

	// auth_url comes from the signer, so it is untrusted input on its way to
	// a new tab: only http(s) survives. The link is the reliable path — a
	// popup opened this late has usually lost the click's user activation.
	const onauth = (url: string) => {
		const safe = safeHttpUrl(url);
		if (!safe) {
			console.warn("nostrSigner: refused a non-http auth_url");
			return;
		}
		authUrl = safe;
		openUrl(safe);
	};

	// Abandon everything in flight: bump the generation, abort the pairing
	// wait, close the signer if one was established, and clear the pairing UI.
	const cancel = () => {
		generation += 1;
		abortController?.abort();
		abortController = null;
		if (activeSigner) void deps.closeSigner(activeSigner);
		activeSigner = null;
		signerRun = null;
		authUrl = null;
		connectUri = null;
		pairMode = null;
		onCancel?.();
	};

	const begin = (run: SignerRunKind): number => {
		cancel();
		signerRun = run;
		onStart?.();
		return generation;
	};

	// The extension and the secret key sign in one step, outside signerRun's
	// booking; they still take a generation, so a Cancel or an unmount while
	// the extension prompt is open drops the late signature.
	const beginDirect = (): number => {
		cancel();
		onStart?.();
		return generation;
	};

	// Sign the NIP-98 event, submit it, and only then persist the pairing — a
	// pairing is worth remembering once it has actually done something. The
	// panel stays booked (signerRun set) through the submit, so a second run
	// cannot start mid-request; the caller's finally closes the signer.
	const finish = async (
		run: number,
		signer: SignerSession["signer"],
		pairing: SignerPairing,
		method: SignerRunKind,
	): Promise<void> => {
		if (run !== generation) return;
		activeSigner = signer;
		const signed = await deps.signWithSigner(signer, template);
		if (run !== generation) return;
		const done = await submit(signed, method);
		if (!done) return;
		trackEvent(events.success, { method });
		// No generation check here: submit awaits the caller's success steps,
		// and a login's add-location flow closes this panel on success —
		// unmount -> cancel bumps the generation. The signature was accepted
		// either way, so the pairing is still worth keeping. It also carries
		// the user's key as named by the signed event, where the bunker pointer
		// names the signer's, and the two can differ.
		const verified = pairingWithSignerKey(pairing, signed.pubkey);
		deps.saveSignerPairing(verified);
		savedPairing = verified;
	};

	// Only this run's signer: a cancelled run that resolves late must not
	// clear the signer a newer run is holding, or cancelling that one leaks
	// its request until the sign timeout.
	const settle = async (
		run: number,
		signer: SignerSession["signer"] | null,
	) => {
		await deps.closeSigner(signer);
		if (activeSigner === signer) activeSigner = null;
		if (run === generation) signerRun = null;
	};

	return {
		get nostrLoading() {
			return nostrLoading;
		},
		get nsecLoading() {
			return nsecLoading;
		},
		get signerRun() {
			return signerRun;
		},
		get authUrl() {
			return authUrl;
		},
		get pairMode() {
			return pairMode;
		},
		get connectUri() {
			return connectUri;
		},
		get savedPairing() {
			return savedPairing;
		},
		get anyLoading() {
			return anyLoading();
		},

		isCurrent: (run: number) => run === generation,
		cancel,

		restorePairing: () => {
			savedPairing = deps.loadSignerPairing();
		},

		forget: () => {
			trackEvent(events.forget);
			deps.clearSignerPairing();
			savedPairing = null;
			cancel();
		},

		// "More options" opened or closed. Not a cancel: the run may be in a
		// row outside it.
		trackOptionsToggle: (open: boolean) => trackEvent(events.toggle, { open }),
		trackAuthUrlClick: () => trackEvent(events.authUrl),

		// false when no NIP-07 provider is there any more (the caller
		// re-probes); the toast is already shown.
		signWithExtension: async (): Promise<boolean> => {
			// Re-entry guard: the busy button still takes clicks (#1548).
			// Without it, one click could open two extension-signing popups.
			if (anyLoading()) return true;
			trackEvent(events.extension, { method: "extension" });
			// Detect at click time rather than at mount: extensions inject
			// window.nostr at their own pace, and the button's state reflects
			// the last probe.
			if (deps.getNostrExtension() === null) {
				trackEvent(events.failure, { method: "extension", status: "client" });
				errToast(t("login.nostrNoExtension"));
				return false;
			}
			const run = beginDirect();
			nostrLoading = true;
			try {
				const signed = await deps.signTemplateWithExtension(template());
				if (run !== generation) return true;
				if (await submit(signed, "extension")) {
					trackEvent(events.success, { method: "extension" });
				}
			} catch (err) {
				if (run === generation) {
					trackFailure("extension", err);
					showError(err, `${logLabel} (extension)`);
				}
			} finally {
				nostrLoading = false;
			}
			return true;
		},

		// `onDecoded` runs once the key decoded and signed, before anything is
		// sent: the caller clears the field there. Resolves false on a failed
		// submit, for the caller to put focus back on the field.
		signWithNsec: async (
			nsec: string,
			onDecoded: () => void,
		): Promise<boolean> => {
			// Re-entry guard: the busy button still takes clicks (#1548), which
			// would decode + sign the same nsec twice and double-fire the
			// submit. Nor while another run is going: both would call submit.
			if (anyLoading() || !nsec.trim()) return true;
			trackEvent(events.nsec, { method: "nsec" });
			const run = beginDirect();
			nsecLoading = true;
			let secretKey: Uint8Array | null = null;

			// Phase 1: decode + sign (sync, only fails on a malformed key).
			let signed: SignedAuthEvent;
			try {
				secretKey = deps.decodeNsec(nsec);
				signed = deps.signTemplateWithSecretKey(template(), secretKey);
			} catch {
				trackEvent(events.failure, { method: "nsec", status: "client" });
				errToast(t("login.nsecInvalid"));
				console.error("Nsec decode failed");
				if (secretKey) secretKey.fill(0);
				nsecLoading = false;
				return true;
			}
			onDecoded();

			// Phase 2: submit. The same bad-credentials classifier, so transport
			// errors don't get mis-reported as "invalid nsec".
			try {
				if (await submit(signed, "nsec")) {
					trackEvent(events.success, { method: "nsec" });
				}
				return true;
			} catch (err) {
				if (run === generation) {
					trackFailure("nsec", err);
					showError(err, `${logLabel} (nsec)`);
				}
				return false;
			} finally {
				// Best-effort zeroing. V8 may have copies elsewhere, but this
				// covers the primary reference.
				secretKey.fill(0);
				nsecLoading = false;
			}
		},

		useSavedPairing: async () => {
			const pairing = savedPairing;
			if (!pairing || anyLoading()) return;
			trackEvent(events.saved, { method: "saved" });
			const run = begin("saved");
			let signer: SignerSession["signer"] | null = null;
			try {
				const result = await deps.connectSavedPairing(pairing, { onauth });
				signer = result.signer;
				await finish(run, signer, result.pairing, "saved");
			} catch (err) {
				// Read before failSigner, whose cancel moves the generation on
				const current = run === generation;
				failSigner(err, run, "saved");
				// A stored pairing that cannot be parsed is worse than none: drop
				// it so the one-click button doesn't fail forever. Only when this
				// run is still the current one — a stale failure must not cancel
				// the newer run — and by clearing storage directly, since the user
				// didn't click Forget.
				if (current && classifySignerError(err) === "invalid") {
					deps.clearSignerPairing();
					savedPairing = null;
				}
			} finally {
				await settle(run, signer);
			}
		},

		// true when this run finished as the current one: the caller clears
		// the URI field.
		connectBunker: async (uri: string): Promise<boolean> => {
			const value = uri.trim();
			if (anyLoading() || !value) return false;
			trackEvent(events.bunker, { method: "bunker" });
			const run = begin("bunker");
			let signer: SignerSession["signer"] | null = null;
			let finished = false;
			try {
				const result = await deps.connectBunkerUri(value, { onauth });
				signer = result.signer;
				await finish(run, signer, result.pairing, "bunker");
				finished = run === generation;
			} catch (err) {
				failSigner(err, run, "bunker");
			} finally {
				await settle(run, signer);
			}
			return finished;
		},

		startPairing: async (presentation: PairMode) => {
			// Another transport is running: the buttons are aria-disabled, and
			// the click they still take must not start a second session.
			// Deliberately not anyLoading — switching between QR, open and copy
			// has to work while this pairing is running.
			if (nostrLoading || nsecLoading) return;
			trackEvent(events[presentation], { method: presentation });
			// One nostrconnect session, several presentations: switching after
			// the URI exists must not restart the pairing the signer may be
			// answering.
			if (signerRun) {
				if (connectUri) {
					pairMode = presentation;
					present(connectUri, presentation, generation);
				}
				return;
			}

			const run = begin(presentation);
			const controller = new AbortController();
			abortController = controller;
			pairMode = presentation;
			let signer: SignerSession["signer"] | null = null;
			try {
				const result = await deps.startNostrConnect({
					signal: controller.signal,
					onauth,
					onUri: (uri) => {
						if (run !== generation) return;
						connectUri = uri;
						present(uri, presentation, run);
					},
				});
				signer = result.signer;
				await finish(run, signer, result.pairing, presentation);
			} catch (err) {
				failSigner(err, run, presentation);
			} finally {
				await settle(run, signer);
				if (run === generation) {
					abortController = null;
					connectUri = null;
					pairMode = null;
				}
			}
		},
	};
};

export type SignerRun = ReturnType<typeof createSignerRun>;
