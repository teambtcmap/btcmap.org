import { forwardLnurlp } from "$lib/lnurlpForwarder";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap";

export const GET: RequestHandler = ({ fetch }) =>
	forwardLnurlp({
		fetch,
		upstream: UPSTREAM,
		identifier: "donations@btcmap.org",
	});
