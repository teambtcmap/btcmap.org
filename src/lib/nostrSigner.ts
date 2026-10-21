// NIP-46 signer-app support for the login flow: a bunker:// URI pasted by the
// user, and a client-initiated nostrconnect:// pairing shown as a QR code,
// copied, or handed to a native app. Both produce a signed NIP-98 event through
// the same transport the API already verifies, so no backend change is
// involved.
//
// nostr-tools' nip46 module is imported lazily: it pulls in relay/websocket
// code that only signer users need, and the extension login must keep working
// if the chunk fails to load.
//
// A completed pairing (client key + bunker URL) is kept in localStorage so the
// next visit is one click. That is a credential at rest: it lets this browser
// ask the signer for signatures, never sign without it.

import { npubEncode } from "nostr-tools/nip19";
import type { BunkerSigner } from "nostr-tools/nip46";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

// Relays the NIP-46 transports publish their requests to: the nostrconnect://
// URI advertises them (the signer subscribes to that list and answers over
// it), and a saved pairing unions them with the relays it was saved with.
//
// They have to accept writes from an arbitrary client. relay.damus.io
// rate-limits them away ("banned: too many rate-limit violations, try again
// later"), which is how #1559 ended with every relay refusing and the panel
// saying "No relay accepted the signer request". relay.nsec.app stays: it is
// the relay nsec.app's signer listens on, so while it is refusing connections
// the other entries carry the request and the day it recovers those users get
// their own relay back. A pasted bunker:// URI keeps using the relays inside
// the URI, which reaches a signer that listens only on its own relay.
export const SIGNER_RELAYS = [
	"wss://relay.nsec.app",
	"wss://relay.nostrconnect.com",
	"wss://relay.primal.net",
	"wss://nos.lol",
	"wss://public.relay.btcmap.org",
];

const CLIENT_NAME = "BTC Map";
// NIP-46 permissions this app needs: read the key, sign NIP-98 events.
const SIGNER_PERMS = ["get_public_key", "sign_event:27235"];
const STORAGE_KEY = "btcmap_nostr_signer";

// A saved signer has already approved this client, so waiting for a fresh
// `connect` ack only costs the user time — several signers never answer one on
// a paired session. A pasted bunker URI is different: the connect is the
// approval prompt, so it gets long enough for someone to reach for a phone.
const SAVED_CONNECT_MS = 3_000;
const PASTE_CONNECT_MS = 12_000;
export const PAIR_TIMEOUT_MS = 180_000;
export const SIGN_TIMEOUT_MS = 120_000;

// Anything the signer layer can close: the concrete BunkerSigner, or a test
// double.
export type Closable = { close?: () => Promise<void> };

// Input that cannot be a bunker URI — the user's mistake, not the signer's — so
// the UI can say "not a bunker URI" instead of "signer failed".
export class SignerInputError extends Error {}

// A signer that stays silent past its deadline: silence, not a rejection.
export class SignerTimeoutError extends Error {}

// Every relay refused the publish (or could not be reached), so the request
// never left the browser — distinct from a signer that received it and stayed
// quiet. nostr-tools surfaces this as an AggregateError from Promise.any, whose
// raw text ("All promises were rejected") is meaningless to a user.
export class SignerRelayError extends Error {}

export type SignerPairing = {
	v: 1;
	// Hex client key paired with the signer; the signer holds the user's key.
	clientSecret: string;
	bunkerUrl: string;
	pubkey: string;
	npub: string | null;
};

// Narrow enough for a test double: anything that signs an event template.
export type SignerLike = {
	signEvent: (event: EventTemplate) => Promise<Event>;
};

export type SignerSession = {
	signer: BunkerSigner;
	pubkey: string;
	pairing: SignerPairing;
};

type SignerOptions = {
	// Signer apps that need a decision open this URL; the app shows it in a tab.
	onauth?: (url: string) => void;
};

export function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

// Error objects from nostr-tools and the DOM carry their class in `name`, which
// survives across realms where `instanceof` does not.
export function hasErrorName(err: unknown, name: string): boolean {
	return (
		typeof err === "object" &&
		err !== null &&
		"name" in err &&
		(err as { name?: unknown }).name === name
	);
}

// A relay URL we are willing to persist: TLS, or plain ws on the loopback for
// local testing. switch_relays output is signer-controlled, so it never goes
// into localStorage unchecked.
function isSecureRelay(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.protocol === "wss:") return true;
		return (
			parsed.protocol === "ws:" &&
			(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
		);
	} catch {
		return false;
	}
}

// Union of relay lists, order preserved, unsafe schemes dropped. A pairing has
// to keep the relays that actually worked for this browser, not only the ones
// the signer prefers.
function uniqueRelays(...lists: string[][]): string[] {
	return [...new Set(lists.flat().filter(isSecureRelay))];
}

// Every await on a signer needs a deadline: a signer that ignores a request is
// silent, not slow, and without one the form hangs forever.
export function withTimeout<T>(
	promise: Promise<T>,
	ms: number,
	message: string,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new SignerTimeoutError(message)), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(error);
			},
		);
	});
}

export function npubFor(pubkey: string): string | null {
	try {
		return npubEncode(pubkey);
	} catch {
		return null;
	}
}

// Display form of an npub (or hex pubkey): npub1abcde…9wxyz. Used wherever a
// key has to be named without a profile — long enough to recognise, short
// enough not to wrap.
export function shortNpub(value: string): string {
	if (value.length <= 18) return value;
	return `${value.slice(0, 12)}…${value.slice(-6)}`;
}

// What went wrong, in the terms the form's messages are written in. HTTP
// failures (a rejected sign-in) come back as "other" and are handled by the
// caller, which can read the response status.
export function classifySignerError(
	err: unknown,
): "invalid" | "timeout" | "relay" | "other" {
	if (err instanceof SignerInputError) return "invalid";
	if (err instanceof SignerTimeoutError) return "timeout";
	if (err instanceof SignerRelayError) return "relay";
	if (hasErrorName(err, "AggregateError")) return "relay";
	return "other";
}

export function loadSignerPairing(): SignerPairing | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<SignerPairing> | null;
		if (parsed?.v !== 1) return null;
		if (
			typeof parsed.clientSecret !== "string" ||
			!/^[0-9a-f]{64}$/.test(parsed.clientSecret)
		) {
			return null;
		}
		if (
			typeof parsed.bunkerUrl !== "string" ||
			!parsed.bunkerUrl.startsWith("bunker://")
		) {
			return null;
		}
		if (
			typeof parsed.pubkey !== "string" ||
			!/^[0-9a-f]{64}$/.test(parsed.pubkey)
		) {
			return null;
		}
		return {
			v: 1,
			clientSecret: parsed.clientSecret,
			bunkerUrl: parsed.bunkerUrl,
			pubkey: parsed.pubkey,
			npub: typeof parsed.npub === "string" ? parsed.npub : null,
		};
	} catch {
		return null;
	}
}

export function saveSignerPairing(pairing: SignerPairing): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(pairing));
	} catch (error) {
		// Private-mode/quota failures only cost the one-click path.
		console.warn("nostrSigner: could not save the signer pairing", error);
	}
}

export function clearSignerPairing(): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to do: the caller drops its in-memory copy either way.
	}
}

export async function closeSigner(signer: Closable | null): Promise<void> {
	if (!signer) return;
	try {
		await signer.close?.();
	} catch {
		// A failed close must not mask the login result.
	}
}

// Sign a NIP-98 event through a connected signer. `buildTemplate` is called
// here, at signing time, rather than by the caller: the API accepts a
// created_at within +/-60s, and connecting a signer can take minutes. The
// template is also what differs between the surfaces that share this module —
// a login signs POST /v4/auth/nostr, linking a key signs PUT
// /v4/users/me/nostr.
export async function signWithSigner(
	signer: SignerLike,
	buildTemplate: () => EventTemplate,
	timeoutMs = SIGN_TIMEOUT_MS,
): Promise<Event> {
	try {
		return await withTimeout(
			signer.signEvent(buildTemplate()),
			timeoutMs,
			"Your signer did not return a signature",
		);
	} catch (error) {
		if (hasErrorName(error, "AggregateError")) {
			throw new SignerRelayError("No relay accepted the signer request");
		}
		throw error;
	}
}

// The pairing's identity is the *user's* key, which only the signed event
// names — the bunker pointer carries the remote signer's key instead, and the
// two differ on signers like nsec.app.
export function pairingWithSignerKey(
	pairing: SignerPairing,
	pubkey: string,
): SignerPairing {
	if (pairing.pubkey === pubkey) return pairing;
	return { ...pairing, pubkey, npub: npubFor(pubkey) };
}

async function loadNip46() {
	return import("nostr-tools/nip46");
}

function clientMetadata() {
	return {
		name: CLIENT_NAME,
		url: typeof window === "undefined" ? undefined : window.location.origin,
	};
}

// NIP-46 connect is optional in practice, and it is the *ack* that is optional,
// not the request. Opal acts on the request itself and either ignores a connect
// on an already-paired session or rejects it outright, so a saved pairing must
// never fail because the ack never came — the sign request that follows is the
// real test. A pasted bunker URI is different: there the connect *is* the
// approval prompt, so an explicit refusal is the user saying no.
async function connectQuietly(
	signer: BunkerSigner,
	waitMs: number,
	{ fatal }: { fatal: boolean },
): Promise<void> {
	try {
		await withTimeout(
			signer.connect(clientMetadata()),
			waitMs,
			"connect was not acknowledged",
		);
	} catch (error) {
		if (fatal && !(error instanceof SignerTimeoutError)) {
			throw hasErrorName(error, "AggregateError")
				? new SignerRelayError("No relay accepted the signer request")
				: error;
		}
		console.warn("nostrSigner: the signer did not acknowledge connect", error);
	}
}

async function pairingFromSigner(
	nip46: typeof import("nostr-tools/nip46"),
	clientSecret: string,
	signer: BunkerSigner,
	pubkey: string,
	startRelays: string[],
): Promise<SignerPairing> {
	// The signer may have moved us onto its own relays (switch_relays) — keep
	// the ones that worked at pairing time too, so a later reconnect is not
	// left with a relay set this browser cannot publish to. The connect secret
	// is single-use per the spec, so the saved URL drops it.
	return {
		v: 1,
		clientSecret,
		bunkerUrl: nip46.toBunkerURL({
			...signer.bp,
			secret: null,
			relays: uniqueRelays(startRelays, signer.bp.relays),
		}),
		pubkey,
		npub: npubFor(pubkey),
	};
}

// Connect a bunker:// URI pasted by the user.
export async function connectBunkerUri(
	input: string,
	options: SignerOptions = {},
): Promise<SignerSession> {
	const value = input.trim();
	// Bunker URIs only: NIP-46 removed NIP-05 login, and the legacy .well-known
	// shape nostr-tools still looks for is no longer published, so a
	// name@domain would only cost a round trip to a domain the user typed.
	if (!value.startsWith("bunker://")) {
		throw new SignerInputError("That is not a bunker:// URI");
	}

	const nip46 = await loadNip46();

	const pointer = await nip46.parseBunkerInput(value);
	if (!pointer) {
		throw new SignerInputError("That is not a bunker:// URI");
	}

	const secretKey = generateSecretKey();
	const signer = nip46.BunkerSigner.fromBunker(secretKey, pointer, {
		onauth: options.onauth,
	});
	try {
		await connectQuietly(signer, PASTE_CONNECT_MS, { fatal: true });
	} catch (error) {
		// A refused connect leaves the relay subscription open; release it
		// before the failure goes back to the form.
		await closeSigner(signer);
		throw error;
	}

	// The bunker pointer names the signer, so this needs no round trip. The
	// pairing's pubkey is corrected from the signed event after login.
	const pubkey = pointer.pubkey;
	return {
		signer,
		pubkey,
		pairing: await pairingFromSigner(
			nip46,
			bytesToHex(secretKey),
			signer,
			pubkey,
			pointer.relays,
		),
	};
}

// Reconnect a saved pairing and hand back its signer, ready to sign.
export async function connectSavedPairing(
	pairing: SignerPairing,
	options: SignerOptions = {},
): Promise<SignerSession> {
	const nip46 = await loadNip46();

	const pointer = await nip46.parseBunkerInput(pairing.bunkerUrl);
	if (!pointer) {
		throw new SignerInputError("The saved signer pairing is not valid");
	}

	// A signer can have switched us onto relays this browser cannot publish to
	// (switch_relays replaced the pointer list at pairing time), and a pairing
	// saved before that was handled keeps only that list. Union with the relays
	// the app itself uses — one reachable relay is enough for the request.
	const relays = uniqueRelays(pointer.relays, SIGNER_RELAYS);

	const signer = nip46.BunkerSigner.fromBunker(
		hexToBytes(pairing.clientSecret),
		{ ...pointer, relays },
		{ onauth: options.onauth },
	);
	await connectQuietly(signer, SAVED_CONNECT_MS, { fatal: false });

	return { signer, pubkey: pointer.pubkey, pairing };
}

// Client-initiated pairing: build a nostrconnect:// URI, hand it to the caller
// (QR, copy, native hand-off), then wait for a signer to answer. fromURI
// resolves only once the signer has paired — which both establishes the
// session and names the signer — so no separate connect() is sent here.
export async function startNostrConnect(
	options: SignerOptions & {
		onUri?: (uri: string) => void;
		signal?: AbortSignal;
		timeoutMs?: number;
	} = {},
): Promise<SignerSession> {
	const nip46 = await loadNip46();

	const secretKey = generateSecretKey();
	const clientSecret = bytesToHex(secretKey);
	const uri = nip46.createNostrConnectURI({
		clientPubkey: getPublicKey(secretKey),
		relays: SIGNER_RELAYS,
		secret: bytesToHex(crypto.getRandomValues(new Uint8Array(16))),
		perms: SIGNER_PERMS,
		...clientMetadata(),
	});

	options.onUri?.(uri);

	const timeoutMs = options.timeoutMs ?? PAIR_TIMEOUT_MS;
	const signer = await withTimeout(
		nip46.BunkerSigner.fromURI(
			secretKey,
			uri,
			{ onauth: options.onauth },
			options.signal ?? timeoutMs,
		),
		timeoutMs,
		"No signer connected to the pairing URI",
	);

	const pubkey = signer.bp.pubkey;
	return {
		signer,
		pubkey,
		pairing: await pairingFromSigner(
			nip46,
			clientSecret,
			signer,
			pubkey,
			SIGNER_RELAYS,
		),
	};
}
