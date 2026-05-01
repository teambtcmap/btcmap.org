import { json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export const GET: RequestHandler = async ({ fetch }) => {
	let res: Response;
	try {
		res = await fetch(UPSTREAM);
	} catch {
		return json(
			{ status: "ERROR", reason: "Upstream unavailable" },
			{ status: 502, headers: CORS_HEADERS },
		);
	}

	if (!res.ok) {
		return json(
			{ status: "ERROR", reason: "Upstream error" },
			{ status: 502, headers: CORS_HEADERS },
		);
	}

	let data: Record<string, unknown>;
	try {
		data = await res.json();
	} catch {
		return json(
			{ status: "ERROR", reason: "Invalid upstream response" },
			{ status: 502, headers: CORS_HEADERS },
		);
	}

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

	return json(data, { headers: CORS_HEADERS });
};
