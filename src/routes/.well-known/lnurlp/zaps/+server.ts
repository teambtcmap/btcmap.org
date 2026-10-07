import { forwardLnurlp } from "#lib/lnurlpForwarder.js";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap-zaps";

export const GET: RequestHandler = ({ fetch }) =>
	forwardLnurlp({
		fetch,
		upstream: UPSTREAM,
		identifier: "zaps@lnbits.btcmap.org",
	});
