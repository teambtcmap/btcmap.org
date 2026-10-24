// Which Nostr sign-in method leads and which sit behind it (#1568). The
// transports are equals in code; on screen the one the device most likely
// has comes first: a signer app on a phone, a NIP-07 extension (or a QR for
// the phone in the user's pocket) on a computer. A pairing that already
// worked beats both.

import type { PairMode, SignerRunKind } from "#lib/signerRun.svelte.js";

export type NostrMethod =
	| "saved"
	| "extension"
	| "open"
	| "qr"
	| "copy"
	| "bunker"
	| "nsec";

// The methods whose rows hold a form
export type NostrForm = Extract<NostrMethod, "bunker" | "nsec">;

export type NostrMethodLayout = {
	primary: NostrMethod;
	rows: NostrMethod[];
	// Behind "More options": technical (bunker) or risky (nsec)
	more: NostrMethod[];
};

type LayoutInput = {
	// matchMedia("(pointer: coarse)"), not UA sniffing
	isTouch: boolean;
	hasExtension: boolean;
	hasSaved: boolean;
};

const TOUCH_ORDER: NostrMethod[] = ["open", "qr", "copy", "extension"];
const DESKTOP_ORDER: NostrMethod[] = ["extension", "qr", "open", "copy"];
const MORE: NostrMethod[] = ["bunker", "nsec"];

export function nostrMethodLayout({
	isTouch,
	hasExtension,
	hasSaved,
}: LayoutInput): NostrMethodLayout {
	// A missing extension is never offered: its only outcome is an error
	const order = (isTouch ? TOUCH_ORDER : DESKTOP_ORDER).filter(
		(method) => method !== "extension" || hasExtension,
	);
	if (hasSaved) return { primary: "saved", rows: order, more: MORE };
	const [primary, ...rows] = order;
	return { primary, rows, more: MORE };
}

export type PanelState = {
	signerRun: SignerRunKind | null;
	pairMode: PairMode | null;
	formOpen: NostrForm | null;
	extensionSigning: boolean;
	nsecSigning: boolean;
	// The running pairing has its nostrconnect URI (until then there is
	// nothing to show, copy or hand off)
	uriReady: boolean;
};

export const isPairing = (method: NostrMethod | null): method is PairMode =>
	method === "qr" || method === "open" || method === "copy";

export const isForm = (method: NostrMethod): method is NostrForm =>
	method === "bunker" || method === "nsec";

// Whether a method's body (QR, status, form) is showing
export function methodOpen(method: NostrMethod, state: PanelState): boolean {
	switch (method) {
		case "saved":
			return state.signerRun === "saved";
		case "extension":
			return false;
		case "bunker":
			return state.formOpen === "bunker" || state.signerRun === "bunker";
		case "nsec":
			return state.formOpen === "nsec";
		default:
			return isPairing(state.signerRun) && state.pairMode === method;
	}
}

// Whether a method can't start now because another one is running. A
// running pairing still owns its three presentations: switching between
// them must not restart it.
export function methodBlocked(method: NostrMethod, state: PanelState): boolean {
	// The open row stays live: a tap on it closes it
	if (methodOpen(method, state)) return false;
	if (isPairing(method)) return pairingClick(state) === "ignore";
	return (
		state.extensionSigning || state.nsecSigning || state.signerRun !== null
	);
}

// What a click on a nostrconnect presentation (QR, hand-off, copy) does
export function pairingClick(state: PanelState): "start" | "switch" | "ignore" {
	if (state.extensionSigning || state.nsecSigning) return "ignore";
	if (state.signerRun === null) return "start";
	return isPairing(state.signerRun) && state.uriReady ? "switch" : "ignore";
}

// A row is a disclosure: a tap on the running pairing closes it. Form rows
// toggle their own form, so they always go through activate.
export function rowClick(
	method: NostrMethod,
	state: PanelState,
): "close" | "activate" {
	return isPairing(method) && methodOpen(method, state) ? "close" : "activate";
}
