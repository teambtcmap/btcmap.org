import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { forwardLnurlp } from "./lnurlpForwarder";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap-zaps";

// What the payee (Rizful) actually serves for zaps@btcmap.org.
const UPSTREAM_METADATA =
	'[["text/plain","Pay Rizful User"],["text/identifier","btcmap-zaps@rizful.com"]]';

// sha256 of UPSTREAM_METADATA in hex. This is the `h` tag of the invoices the
// payee hands out, and what verifying wallets compare against the metadata
// they were served. If the forwarder alters the metadata string, this no
// longer matches and wallets abort with "h-tag mismatch".
const UPSTREAM_METADATA_SHA256 =
	"82426c8d379aefdf8218c8255e44c2bf2a0f551b3cf6378b573e25fd1d87f339";

const upstreamBody = () => ({
	callback: "https://rizful.com/lnurl_two/btcmap-zaps/get_invoice",
	minSendable: 1000,
	maxSendable: 25000000000,
	status: "OK",
	tag: "payRequest",
	metadata: UPSTREAM_METADATA,
	allowsNostr: true,
	nostrPubkey:
		"0e634713040189889b41cd331605c995178463be420c37b39f5af89d797a6fa4",
	commentAllowed: 224,
});

const sha256 = (value: string) =>
	createHash("sha256").update(value).digest("hex");

const fetchReturning = (body: unknown, init?: ResponseInit) =>
	vi.fn(async () => new Response(JSON.stringify(body), init));

describe("forwardLnurlp", () => {
	it("forwards metadata byte-for-byte so the invoice h tag still matches", async () => {
		const res = await forwardLnurlp({
			fetch: fetchReturning(upstreamBody()),
			upstream: UPSTREAM,
		});

		const data = await res.json();

		expect(data.metadata).toBe(UPSTREAM_METADATA);
		expect(sha256(data.metadata)).toBe(UPSTREAM_METADATA_SHA256);
	});

	it("passes every upstream field through unchanged", async () => {
		const expected = upstreamBody();

		const res = await forwardLnurlp({
			fetch: fetchReturning(expected),
			upstream: UPSTREAM,
		});

		expect(await res.json()).toEqual(expected);
	});

	it("requests the configured upstream and allows cross-origin callers", async () => {
		const fetchFn = fetchReturning(upstreamBody());

		const res = await forwardLnurlp({ fetch: fetchFn, upstream: UPSTREAM });

		expect(fetchFn).toHaveBeenCalledWith(
			UPSTREAM,
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	it("surfaces upstream failures as a 502 instead of a broken payRequest", async () => {
		const res = await forwardLnurlp({
			fetch: vi.fn(async () => {
				throw new Error("boom");
			}),
			upstream: UPSTREAM,
		});

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({
			status: "ERROR",
			reason: "Upstream unavailable",
		});
	});

	it("rejects non-object upstream responses", async () => {
		const res = await forwardLnurlp({
			fetch: fetchReturning([]),
			upstream: UPSTREAM,
		});

		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({
			status: "ERROR",
			reason: "Invalid upstream response",
		});
	});
});
