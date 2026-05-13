import { json } from "@sveltejs/kit";

const TIMEOUT_MS = 5000;
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

type ForwardLnurlpOptions = {
	fetch: typeof fetch;
	upstream: string;
	identifier: string;
};

const isMetadataEntry = (entry: unknown): entry is [string, string] =>
	Array.isArray(entry) &&
	entry.length === 2 &&
	typeof entry[0] === "string" &&
	typeof entry[1] === "string";

const rewriteMetadataIdentifier = (
	metadata: string,
	identifier: string,
): string => {
	try {
		const parsed: unknown = JSON.parse(metadata);

		if (!Array.isArray(parsed) || !parsed.every(isMetadataEntry)) {
			return metadata;
		}

		return JSON.stringify(
			parsed.map(([type, value]) =>
				type === "text/identifier" ? [type, identifier] : [type, value],
			),
		);
	} catch {
		return metadata;
	}
};

export const forwardLnurlp = async ({
	fetch,
	upstream,
	identifier,
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

	if (typeof data.metadata === "string") {
		data.metadata = rewriteMetadataIdentifier(data.metadata, identifier);
	}

	return json(data, { headers: CORS_HEADERS });
};
