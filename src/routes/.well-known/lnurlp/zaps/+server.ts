import { forwardLnurlp } from "#lib/lnurlpForwarder.js";

import type { RequestHandler } from "./$types";

// Settles to the "Zaps" wallet in our own LNbits (LNURL-pay username "zaps",
// public address zaps@lnbits.btcmap.org) — the identifier that wallet serves
// is what wallets display, so zaps@btcmap.org reads as zaps@lnbits.btcmap.org.
const UPSTREAM = "https://lnbits.btcmap.org/.well-known/lnurlp/zaps";

export const GET: RequestHandler = ({ fetch }) =>
	forwardLnurlp({
		fetch,
		upstream: UPSTREAM,
	});
