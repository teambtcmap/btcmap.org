import { npubEncode } from "nostr-tools/nip19";
import type { Event, EventTemplate } from "nostr-tools/pure";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildAuthTemplate, buildNip98Template, NOSTR_LINK_URL } from "./nostr";
import {
	bytesToHex,
	classifySignerError,
	clearSignerPairing,
	connectBunkerUri,
	connectSavedPairing,
	hexToBytes,
	loadSignerPairing,
	npubFor,
	pairingWithSignerKey,
	SIGNER_RELAYS,
	SignerInputError,
	SignerRelayError,
	SignerTimeoutError,
	saveSignerPairing,
	shortNpub,
	signWithSigner,
	startNostrConnect,
	withTimeout,
} from "./nostrSigner";

// The NIP-46 transport is mocked so the wiring (parse → fromBunker → connect →
// sign) is testable without a relay or a phone signer.
const nip46Mock = vi.hoisted(() => {
	const state = {
		parseResult: null as {
			pubkey: string;
			relays: string[];
			secret: string | null;
		} | null,
		connectBehaviour: "resolve" as "resolve" | "reject" | "hang",
		fromBunkerArgs: [] as unknown[][],
		connectMetadata: [] as unknown[],
		parseCalls: [] as string[],
		bunkerPointers: [] as { relays?: string[] }[],
		closeCalls: 0,
	};
	const signerPubkey = "ef".repeat(32);
	const makeSigner = () => ({
		bp: { pubkey: signerPubkey, relays: ["wss://relay.example"], secret: "s" },
		connect: (metadata?: unknown) => {
			state.connectMetadata.push(metadata);
			if (state.connectBehaviour === "reject") {
				return Promise.reject(new Error("already connected"));
			}
			if (state.connectBehaviour === "hang") {
				return new Promise<void>(() => {});
			}
			return Promise.resolve();
		},
		signEvent: (event: EventTemplate) =>
			Promise.resolve({ ...event, id: "signed" } as unknown as Event),
		close: () => {
			state.closeCalls += 1;
			return Promise.resolve();
		},
	});
	return { state, makeSigner, signerPubkey };
});

vi.mock("nostr-tools/nip46", () => ({
	parseBunkerInput: (input: string) => {
		nip46Mock.state.parseCalls.push(input);
		return Promise.resolve(
			input.startsWith("bunker://") ? nip46Mock.state.parseResult : null,
		);
	},
	BunkerSigner: {
		fromBunker: (...args: unknown[]) => {
			nip46Mock.state.fromBunkerArgs.push(args);
			return nip46Mock.makeSigner();
		},
		fromURI: () => Promise.resolve(nip46Mock.makeSigner()),
	},
	toBunkerURL: (bp: { pubkey: string; relays?: string[] }) => {
		nip46Mock.state.bunkerPointers.push(bp);
		return `bunker://${bp.pubkey}?relay=wss%3A%2F%2Frelay.example&secret=s`;
	},
	createNostrConnectURI: () =>
		"nostrconnect://abc?relay=wss%3A%2F%2Frelay.example&secret=s",
}));

const CLIENT_SECRET = "ab".repeat(32);
const SIGNER_PUBKEY = "cd".repeat(32);

const validPairing = () => ({
	v: 1 as const,
	clientSecret: CLIENT_SECRET,
	bunkerUrl: `bunker://${SIGNER_PUBKEY}?relay=wss%3A%2F%2Frelay.nsec.app`,
	pubkey: SIGNER_PUBKEY,
	npub: npubEncode(SIGNER_PUBKEY),
});

beforeEach(() => {
	nip46Mock.state.parseResult = {
		pubkey: nip46Mock.signerPubkey,
		relays: ["wss://relay.example"],
		secret: "s",
	};
	nip46Mock.state.connectBehaviour = "resolve";
	nip46Mock.state.fromBunkerArgs = [];
	nip46Mock.state.connectMetadata = [];
	nip46Mock.state.parseCalls = [];
	nip46Mock.state.bunkerPointers = [];
	nip46Mock.state.closeCalls = 0;
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("withTimeout", () => {
	it("passes a resolved value through", async () => {
		await expect(
			withTimeout(Promise.resolve("ok"), 1000, "late"),
		).resolves.toBe("ok");
	});

	it("passes a rejection through untouched", async () => {
		const failure = new Error("rejected");
		await expect(
			withTimeout(Promise.reject(failure), 1000, "late"),
		).rejects.toBe(failure);
	});

	it("rejects with a SignerTimeoutError when the promise goes silent", async () => {
		vi.useFakeTimers();
		try {
			const pending = withTimeout(
				new Promise<string>(() => {}),
				5000,
				"no answer",
			);
			const assertion =
				expect(pending).rejects.toBeInstanceOf(SignerTimeoutError);
			await vi.advanceTimersByTimeAsync(5000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("does not time out a promise that settles first", async () => {
		vi.useFakeTimers();
		try {
			const pending = withTimeout(Promise.resolve("in time"), 5000, "late");
			await vi.advanceTimersByTimeAsync(1000);
			await expect(pending).resolves.toBe("in time");
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("bytesToHex / hexToBytes", () => {
	it("round-trips a secret key", () => {
		const secretKey = generateSecretKey();
		expect(Array.from(hexToBytes(bytesToHex(secretKey)))).toEqual(
			Array.from(secretKey),
		);
	});

	it("pads single-digit bytes", () => {
		expect(bytesToHex(new Uint8Array([0, 1, 15, 255]))).toBe("00010fff");
	});
});

describe("signer pairing storage", () => {
	it("round-trips a pairing through localStorage", () => {
		const pairing = validPairing();
		saveSignerPairing(pairing);
		expect(loadSignerPairing()).toEqual(pairing);
		clearSignerPairing();
		expect(loadSignerPairing()).toBeNull();
	});

	it("narrows a missing npub to null", () => {
		const pairing = { ...validPairing(), npub: null };
		saveSignerPairing(pairing);
		expect(loadSignerPairing()).toEqual(pairing);
		clearSignerPairing();
	});

	it("ignores malformed JSON", () => {
		localStorage.setItem("btcmap_nostr_signer", "{not json");
		expect(loadSignerPairing()).toBeNull();
	});

	it("ignores an unknown record version", () => {
		localStorage.setItem(
			"btcmap_nostr_signer",
			JSON.stringify({ ...validPairing(), v: 2 }),
		);
		expect(loadSignerPairing()).toBeNull();
	});

	it("rejects a client secret that is not 32 bytes of hex", () => {
		localStorage.setItem(
			"btcmap_nostr_signer",
			JSON.stringify({ ...validPairing(), clientSecret: "not-hex" }),
		);
		expect(loadSignerPairing()).toBeNull();
	});

	it("rejects a bunker URL that is not a bunker URI", () => {
		localStorage.setItem(
			"btcmap_nostr_signer",
			JSON.stringify({ ...validPairing(), bunkerUrl: "https://example.com" }),
		);
		expect(loadSignerPairing()).toBeNull();
	});
});

describe("signWithSigner", () => {
	// The login path's template; the link path passes the same factory shape
	// with its own URL and method.
	const loginTemplate = buildAuthTemplate;

	it("asks the signer for a fresh NIP-98 event at signing time", async () => {
		vi.useFakeTimers();
		try {
			vi.setSystemTime(new Date("2026-01-02T03:04:05Z"));
			const captured: EventTemplate[] = [];
			const signer = {
				signEvent: (event: EventTemplate) => {
					captured.push(event);
					return Promise.resolve({ id: "signed" } as unknown as Event);
				},
			};
			await signWithSigner(signer, loginTemplate);
			expect(captured).toHaveLength(1);
			const template = captured.at(0);
			expect(template?.kind).toBe(27235);
			expect(template?.created_at).toBe(
				Math.floor(new Date("2026-01-02T03:04:05Z").getTime() / 1000),
			);
			expect(template?.content).toBe("");
			expect(template?.tags).toContainEqual(["method", "POST"]);
			expect(template?.tags.find((tag) => tag[0] === "u")?.[1]).toMatch(
				/\/v4\/auth\/nostr$/,
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it("signs whatever the template factory builds", async () => {
		const captured: EventTemplate[] = [];
		const signer = {
			signEvent: (event: EventTemplate) => {
				captured.push(event);
				return Promise.resolve({ id: "signed" } as unknown as Event);
			},
		};

		await signWithSigner(signer, () =>
			buildNip98Template(NOSTR_LINK_URL, "PUT"),
		);

		expect(captured.at(0)?.tags).toEqual([
			["u", NOSTR_LINK_URL],
			["method", "PUT"],
		]);
	});

	it("rejects with a SignerTimeoutError when the signer stays silent", async () => {
		vi.useFakeTimers();
		try {
			const signer = { signEvent: () => new Promise<never>(() => {}) };
			const pending = signWithSigner(signer, loginTemplate, 1000);
			const assertion =
				expect(pending).rejects.toBeInstanceOf(SignerTimeoutError);
			await vi.advanceTimersByTimeAsync(1000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("reports a rejected publish as a relay error, not the raw AggregateError", async () => {
		const signer = {
			signEvent: () =>
				Promise.reject(
					Object.assign(new Error("All promises were rejected"), {
						name: "AggregateError",
					}),
				),
		};
		await expect(signWithSigner(signer, loginTemplate)).rejects.toBeInstanceOf(
			SignerRelayError,
		);
	});
});

describe("npubFor", () => {
	it("encodes a hex pubkey", () => {
		const pubkey = getPublicKey(generateSecretKey());
		expect(npubFor(pubkey)).toBe(npubEncode(pubkey));
	});

	it("returns null for a value that is not a pubkey", () => {
		expect(npubFor("nope")).toBeNull();
	});
});

describe("shortNpub", () => {
	it("shortens an npub to a recognisable head and tail", () => {
		const npub = npubEncode("cd".repeat(32));
		const short = shortNpub(npub);
		expect(short).toBe(`${npub.slice(0, 12)}…${npub.slice(-6)}`);
		expect(short.length).toBeLessThan(npub.length);
		expect(short.startsWith("npub1")).toBe(true);
	});

	it("shortens a hex pubkey the same way", () => {
		expect(shortNpub("cd".repeat(32))).toBe("cdcdcdcdcdcd…cdcdcd");
	});

	it("leaves a value too short to shorten alone", () => {
		expect(shortNpub("npub1short")).toBe("npub1short");
	});
});

describe("connectSavedPairing", () => {
	it("reconnects with the stored client secret and names the signer", async () => {
		const session = await connectSavedPairing(validPairing());
		expect(session.pubkey).toBe(nip46Mock.signerPubkey);
		expect(nip46Mock.state.fromBunkerArgs[0]?.[0]).toEqual(
			hexToBytes(CLIENT_SECRET),
		);
		expect(nip46Mock.state.connectMetadata[0]).toMatchObject({
			name: "BTC Map",
		});
	});

	// Some signers reject (or ignore) a connect on an already-paired session; a
	// saved pairing must survive both, or the one-click button dies on every
	// signer that behaves this way.
	it("signs anyway when the signer rejects the connect ack", async () => {
		nip46Mock.state.connectBehaviour = "reject";
		await expect(connectSavedPairing(validPairing())).resolves.toBeTruthy();
	});

	it("signs anyway when the signer never answers connect", async () => {
		nip46Mock.state.connectBehaviour = "hang";
		vi.useFakeTimers();
		try {
			const pending = connectSavedPairing(validPairing());
			const assertion = expect(pending).resolves.toBeTruthy();
			await vi.advanceTimersByTimeAsync(3000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("rejects a stored URL that is no longer a bunker URI", async () => {
		nip46Mock.state.parseResult = null;
		await expect(connectSavedPairing(validPairing())).rejects.toBeInstanceOf(
			SignerInputError,
		);
	});

	// The saved URL can list only relays the signer prefers — including ones
	// this browser cannot publish to. Union with the app's own relays, or the
	// request never leaves the browser ("All promises were rejected").
	it("publishes to the app's relays as well as the stored ones", async () => {
		await connectSavedPairing(validPairing());
		const pointer = nip46Mock.state.fromBunkerArgs[0]?.[1] as {
			relays: string[];
		};
		expect(pointer.relays).toEqual(
			expect.arrayContaining(["wss://relay.example", ...SIGNER_RELAYS]),
		);
	});

	it("drops stored relays that are not wss", async () => {
		nip46Mock.state.parseResult = {
			pubkey: nip46Mock.signerPubkey,
			relays: ["http://evil.example", "wss://good.example"],
			secret: null,
		};
		await connectSavedPairing(validPairing());
		const pointer = nip46Mock.state.fromBunkerArgs[0]?.[1] as {
			relays: string[];
		};
		expect(pointer.relays).toContain("wss://good.example");
		expect(pointer.relays).not.toContain("http://evil.example");
	});
});

describe("classifySignerError", () => {
	it("names each failure class the form has a message for", () => {
		expect(classifySignerError(new SignerInputError("x"))).toBe("invalid");
		expect(classifySignerError(new SignerTimeoutError("x"))).toBe("timeout");
		expect(classifySignerError(new SignerRelayError("x"))).toBe("relay");
		expect(
			classifySignerError(
				Object.assign(new Error("All promises were rejected"), {
					name: "AggregateError",
				}),
			),
		).toBe("relay");
		expect(classifySignerError(new Error("whatever"))).toBe("other");
	});
});

describe("pairingWithSignerKey", () => {
	it("replaces the signer's key with the user's key from the signed event", () => {
		const pairing = validPairing();
		const userPubkey = "12".repeat(32);
		const updated = pairingWithSignerKey(pairing, userPubkey);
		expect(updated.pubkey).toBe(userPubkey);
		expect(updated.npub).toBe(npubEncode(userPubkey));
		expect(updated.clientSecret).toBe(pairing.clientSecret);
	});

	it("returns the same record when the key already matches", () => {
		const pairing = validPairing();
		expect(pairingWithSignerKey(pairing, pairing.pubkey)).toBe(pairing);
	});
});

describe("startNostrConnect", () => {
	// switch_relays rewrites bp.relays with the signer's list; the pairing must
	// still remember the relays that actually reached it.
	it("keeps the pairing's original relays when the signer switches", async () => {
		const uris: string[] = [];
		await startNostrConnect({ onUri: (uri) => uris.push(uri) });

		expect(uris).toHaveLength(1);
		const pointer = nip46Mock.state.bunkerPointers.at(-1);
		expect(pointer?.relays).toEqual(
			expect.arrayContaining(["wss://relay.example", ...SIGNER_RELAYS]),
		);
	});

	// The connect secret is single-use per NIP-46, and a stored one is a spent
	// credential: the saved URL drops it.
	it("drops the spent connect secret from the pairing", async () => {
		await startNostrConnect({});
		const pointer = nip46Mock.state.bunkerPointers.at(-1) as {
			secret?: string | null;
		};
		expect(pointer.secret ?? null).toBeNull();
	});
});

describe("connectBunkerUri", () => {
	const uri = `bunker://${SIGNER_PUBKEY}?relay=wss%3A%2F%2Frelay.example`;

	it("fails when the signer explicitly refuses the connect", async () => {
		nip46Mock.state.connectBehaviour = "reject";
		await expect(connectBunkerUri(uri)).rejects.toThrow("already connected");
		// The refused attempt must not leave its relay subscription open.
		expect(nip46Mock.state.closeCalls).toBeGreaterThan(0);
	});

	it("continues when the connect ack only times out", async () => {
		nip46Mock.state.connectBehaviour = "hang";
		vi.useFakeTimers();
		try {
			const pending = connectBunkerUri(uri);
			const assertion = expect(pending).resolves.toBeTruthy();
			await vi.advanceTimersByTimeAsync(12_000);
			await assertion;
		} finally {
			vi.useRealTimers();
		}
	});

	it("rejects input that is neither a bunker URI nor NIP-05", async () => {
		nip46Mock.state.parseResult = null;
		await expect(connectBunkerUri("nope")).rejects.toBeInstanceOf(
			SignerInputError,
		);
	});

	// NIP-46 dropped NIP-05 login; a name@domain must not trigger a lookup
	// against the user's typed domain (and then fail confusingly).
	it("refuses a NIP-05 address without any network lookup", async () => {
		await expect(connectBunkerUri("alice@example.com")).rejects.toBeInstanceOf(
			SignerInputError,
		);
		expect(nip46Mock.state.parseCalls).toEqual([]);
	});
});
