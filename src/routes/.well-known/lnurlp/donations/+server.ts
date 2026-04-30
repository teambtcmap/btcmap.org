import { json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap";

export const GET: RequestHandler = async ({ fetch }) => {
	const res = await fetch(UPSTREAM);
	const data = await res.json();

	// Rewrite the text/identifier in metadata so wallets show donations@btcmap.org
	if (typeof data.metadata === "string") {
		try {
			const parsed: [string, string][] = JSON.parse(data.metadata);
			data.metadata = JSON.stringify(
				parsed.map(([type, value]) =>
					type === "text/identifier"
						? [type, "donations@btcmap.org"]
						: [type, value],
				),
			);
		} catch {
			// leave metadata as-is if parsing fails
		}
	}

	return json(data, {
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
	});
};
