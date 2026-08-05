// Server-only client for the btcmap-api JSON-RPC endpoint (/rpc).
//
// Currently exposes submit_place, the sanctioned import pipeline: it puts a
// place on BTC Map instantly (in btcmap-api's own database) and lets editors
// merge it into OSM later. We call it on maintainer approval, never on raw
// public submission, so it doesn't bypass spam review.
//
// Requires a trusted bearer token with the places_source role, provisioned by
// the btcmap-api maintainers. Everything is gated behind btcmapApiConfigured()
// so the site runs without the token — the submit simply stays disabled.

import { API_BASE } from "$lib/api-base";
import type { OsmPayload } from "$lib/osmPayload";

import { env } from "$env/dynamic/private";

const DEFAULT_ORIGIN = "btcmap-org";

export function btcmapApiConfigured(): boolean {
	return Boolean(env.BTCMAP_API_RPC_TOKEN);
}

function importOrigin(): string {
	return env.BTCMAP_PLACE_IMPORT_ORIGIN || DEFAULT_ORIGIN;
}

type SubmitPlaceResult = {
	id: number;
	origin: string;
	external_id: string;
};

async function rpc<T>(
	method: string,
	params: Record<string, unknown>,
): Promise<T> {
	const res = await fetch(`${API_BASE}/rpc`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.BTCMAP_API_RPC_TOKEN}`,
		},
		body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
	});
	const text = await res.text();
	if (!res.ok) {
		throw new Error(`btcmap-api ${method} failed (${res.status}): ${text}`);
	}
	const parsed = JSON.parse(text);
	if (parsed.error) {
		throw new Error(
			`btcmap-api ${method} error: ${JSON.stringify(parsed.error)}`,
		);
	}
	return parsed.result as T;
}

// Map an OSM create-payload to submit_place params. external_id is derived from
// the Gitea issue so a re-approval patches the same record instead of
// duplicating it (submit_place is idempotent on (origin, external_id)).
export async function submitPlaceFromPayload(
	payload: OsmPayload,
	externalId: string,
): Promise<SubmitPlaceResult> {
	if (!btcmapApiConfigured()) {
		throw new Error(
			"submit_place not configured (missing BTCMAP_API_RPC_TOKEN)",
		);
	}
	const name = payload.tags.name;
	const category = payload.category;
	if (!name) throw new Error("submit_place payload missing name");
	if (!category) throw new Error("submit_place payload missing category");
	if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
		throw new Error("submit_place payload missing coordinates");
	}

	// Carry the human-relevant tags across as extra_fields for editor review.
	const extraFields: Record<string, string> = {};
	const carry: Array<[string, string]> = [
		["website", "contact:website"],
		["phone", "contact:phone"],
		["opening_hours", "opening_hours"],
		["twitter", "contact:twitter"],
		["facebook", "contact:facebook"],
		["instagram", "contact:instagram"],
	];
	for (const [field, tag] of carry) {
		if (payload.tags[tag]) extraFields[field] = payload.tags[tag];
	}
	if (payload.tags["payment:onchain"]) extraFields.payment_onchain = "yes";
	if (payload.tags["payment:lightning"]) extraFields.payment_lightning = "yes";
	if (payload.tags["payment:lightning_contactless"])
		extraFields.payment_lightning_contactless = "yes";

	return rpc<SubmitPlaceResult>("submit_place", {
		origin: importOrigin(),
		external_id: externalId,
		lat: payload.lat,
		lon: payload.lon,
		category,
		name,
		extra_fields: extraFields,
	});
}
