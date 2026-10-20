// NIP-46 signer-app support for the login flow: a bunker:// URI (or NIP-05
// address) pasted by the user, and a client-initiated nostrconnect:// pairing
// shown as a QR code or handed to a native app. Both produce a signed NIP-98
// event through the same transport the API already verifies, so no backend
// change is involved.
//
// nostr-tools' nip46 module is imported lazily: it pulls in relay/websocket
// code that only signer users need, and the extension login must keep working
// if the chunk fails to load.
//
// A completed pairing (client secret + bunker URL) is kept in localStorage so
// the next visit is one click. That is a credential at rest: it lets this
// browser ask the signer for signatures, never sign without it.

import { npubEncode } from "nostr-tools/nip19";
import type { BunkerSigner } from "nostr-tools/nip46";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";

import { buildAuthTemplate } from "#lib/nostr.js";

export const SIGNER_RELAYS = ["wss://relay.nsec.app", "wss://relay.damus.io"];

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

// Input that cannot be a bunker URI/NIP-05 — the user's mistake, not the
// signer's — so the UI can say "not a bunker URI" instead of "signer failed".
export class SignerInputError extends Error {}

// A signer that stays silent past its deadline: silence, not a rejection.
export class SignerTimeoutError extends Error {}

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

export function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}

export function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
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

export async function closeSigner(signer: {
	close?: () => Promise<void>;
}): Promise<void> {
	try {
		await signer.close?.();
	} catch {
		// A failed close must not mask the login result.
	}
}

export async function signWithSigner(
	signer: SignerLike,
	timeoutMs = SIGN_TIMEOUT_MS,
): Promise<Event> {
	// The template is built here, at signing time: the API accepts a created_at
	// within +/-60s, and connecting a signer can take minutes.
	return withTimeout(
		signer.signEvent(buildAuthTemplate()),
		timeoutMs,
		"Your signer did not return a signature",
	);
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
		if (fatal && !(error instanceof SignerTimeoutError)) throw error;
		console.warn("nostrSigner: the signer did not acknowledge connect", error);
	}
}

async function pairingFromSigner(
	nip46: typeof import("nostr-tools/nip46"),
	clientSecret: string,
	signer: BunkerSigner,
	pubkey: string,
): Promise<SignerPairing> {
	return {
		v: 1,
		clientSecret,
		bunkerUrl: nip46.toBunkerURL(signer.bp),
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
	// Bunker URIs only. NIP-46 removed NIP-05 login, and nostr-tools' legacy
	// lookup still resolves name@domain against the old .well-known shape that
	// current signers no longer publish — accepting one here only buys a
	// network round trip to a domain the user typed, then a confusing failure.
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
	await connectQuietly(signer, PASTE_CONNECT_MS, { fatal: true });

	// The bunker pointer names the signer, so this needs no round trip.
	const pubkey = pointer.pubkey;
	return {
		signer,
		pubkey,
		pairing: await pairingFromSigner(nip46, toHex(secretKey), signer, pubkey),
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

	const signer = nip46.BunkerSigner.fromBunker(
		fromHex(pairing.clientSecret),
		pointer,
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
	const clientSecret = toHex(secretKey);
	const uri = nip46.createNostrConnectURI({
		clientPubkey: getPublicKey(secretKey),
		relays: SIGNER_RELAYS,
		secret: toHex(crypto.getRandomValues(new Uint8Array(16))),
		perms: SIGNER_PERMS,
		name: CLIENT_NAME,
		url: typeof window === "undefined" ? undefined : window.location.origin,
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
		pairing: await pairingFromSigner(nip46, clientSecret, signer, pubkey),
	};
}
