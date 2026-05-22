import { forwardLnurlp } from "$lib/lnurlpForwarder";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://coinos.io/.well-known/lnurlp/comino";

export const GET: RequestHandler = ({ fetch }) =>
	forwardLnurlp({
		fetch,
		upstream: UPSTREAM,
		identifier: "comino@btcmap.org",
	});
