import { json } from "@sveltejs/kit";

import type { RequestHandler } from "./$types";

const UPSTREAM = "https://rizful.com/.well-known/lnurlp/btcmap-zaps";
const TIMEOUT_MS = 5000;

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

export const GET: RequestHandler = async ({ fetch }) => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	let res: Response;
	try {
		res = await fetch(UPSTREAM, { signal: controller.signal });
	} catch {
		return json(
			{ status: "ERROR", reason: "Upstream unavailable" },
			{ status: 502, headers: CORS_HEADERS },
		);
	} finally {
		clearTimeout(timeout);
	}

	if (!res.ok) {
		return json(
			{ status: "ERROR", reason: "Upstream error" },
			{ status: 502, headers: CORS_HEADERS },
		);
	}

	let data: Record<string, unknown>;
	try {
		const parsed: unknown = await res.json();
		if (
			parsed === null ||
			typeof parsed !== "object" ||
			Array.isArray(parsed)
		) {
			return json(
				{ status: "ERROR", reason: "Invalid upstream response" },
				{ status: 502, headers: CORS_HEADERS },
			);
		}
		data = parsed as Record<string, unknown>;
	} catch {
		return json(
			{ status: "ERROR", reason: "Invalid upstream response" },
			{ status: 502, headers: CORS_HEADERS },
		);
	}

	// Rewrite the text/identifier in metadata so wallets show zaps@btcmap.org
	if (typeof data.metadata === "string") {
		try {
			const parsed: [string, string][] = JSON.parse(data.metadata);
			data.metadata = JSON.stringify(
				parsed.map(([type, value]) =>
					type === "text/identifier"
						? [type, "zaps@btcmap.org"]
						: [type, value],
				),
			);
		} catch {
			// leave metadata as-is if parsing fails
		}
	}

	return json(data, { headers: CORS_HEADERS });
};
