import { json } from "@sveltejs/kit";

const TIMEOUT_MS = 5000;
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

type ForwardLnurlpOptions = {
	fetch: typeof fetch;
	upstream: string;
};

export const forwardLnurlp = async ({
	fetch,
	upstream,
}: ForwardLnurlpOptions): Promise<Response> => {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	let res: Response;
	try {
		res = await fetch(upstream, { signal: controller.signal });
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

	// `metadata` is forwarded byte-for-byte on purpose. The payee's invoice
	// commits to sha256(metadata) in its `h` tag, and the payee hashes the
	// metadata it served — not whatever we send. Editing it here (e.g.
	// rewriting text/identifier so wallets display an @btcmap.org address)
	// makes verifying wallets reject every invoice with:
	// "The invoice does not match the LNURL metadata (h-tag mismatch)".
	return json(data, { headers: CORS_HEADERS });
};
