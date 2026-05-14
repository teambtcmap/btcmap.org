import { forwardLnurlp } from "$lib/lnurlpForwarder";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://coinos.io/.well-known/lnurlp/rose";

export const GET: RequestHandler = ({ fetch }) =>
	forwardLnurlp({
		fetch,
		upstream: UPSTREAM,
		identifier: "rose@btcmap.org",
	});
