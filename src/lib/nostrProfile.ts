import { decode } from "nostr-tools/nip19";
import { SimplePool } from "nostr-tools/pool";

// Fields we read from a user's NIP-01 kind:0 metadata event. All optional —
// a profile may set any subset (or publish nothing at all).
export type NostrProfile = {
	name?: string;
	displayName?: string;
	picture?: string;
	nip05?: string;
};

// Small hardcoded starter relay set queried for kind:0 metadata; first relay
// to answer wins. NIP-65 (kind:10002) relay discovery is a later refinement.
const RELAYS = [
	"wss://relay.damus.io",
	"wss://nos.lol",
	"wss://relay.nostr.band",
];

// The avatar is non-critical chrome, so fail fast and fall back to the icon
// rather than make the user wait on a slow relay.
const MAX_WAIT_MS = 3000;

// Session-lifetime cache keyed by hex pubkey. Negatives (null) are cached too,
// so a profile-less npub isn't refetched on every render.
const cache = new Map<string, NostrProfile | null>();

let pool: SimplePool | null = null;
function getPool(): SimplePool {
	if (!pool) pool = new SimplePool();
	return pool;
}

// Normalize an npub (or an already-hex pubkey) to lowercase hex. Returns null
// for anything that isn't a valid npub / 32-byte hex key so callers can no-op.
function toHex(npubOrHex: string): string | null {
	const value = npubOrHex.trim();
	if (/^[0-9a-f]{64}$/i.test(value)) return value.toLowerCase();
	try {
		const decoded = decode(value);
		return decoded.type === "npub" ? (decoded.data as string) : null;
	} catch {
		return null;
	}
}

function parseMetadata(content: string): NostrProfile | null {
	try {
		const meta = JSON.parse(content) as Record<string, unknown>;
		const profile: NostrProfile = {};
		if (typeof meta.name === "string") profile.name = meta.name;
		if (typeof meta.display_name === "string")
			profile.displayName = meta.display_name;
		if (typeof meta.picture === "string") profile.picture = meta.picture;
		if (typeof meta.nip05 === "string") profile.nip05 = meta.nip05;
		return profile;
	} catch {
		return null;
	}
}

// Fetch a user's kind:0 profile from relays. Resolves to null (never rejects)
// when there's no profile, the relays time out, or the input is invalid.
// Cached for the page session.
export async function fetchProfile(
	npubOrHex: string,
): Promise<NostrProfile | null> {
	// Relay queries open WebSockets — browser only. Guard SSR.
	if (typeof window === "undefined") return null;

	const hex = toHex(npubOrHex);
	if (!hex) return null;

	if (cache.has(hex)) return cache.get(hex) ?? null;

	let profile: NostrProfile | null = null;
	try {
		const event = await getPool().get(
			RELAYS,
			{ kinds: [0], authors: [hex] },
			{ maxWait: MAX_WAIT_MS },
		);
		profile = event ? parseMetadata(event.content) : null;
	} catch {
		profile = null;
	}

	cache.set(hex, profile);
	return profile;
}
