import { error, json } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import type { AddLocationSubmission } from "$lib/placeSubmission";
import { buildSubmitPlaceParams } from "$lib/placeSubmission";
import { validateCaptcha } from "$lib/server/captcha";
import { isValidLatitude, isValidLongitude } from "$lib/utils";

import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";

// Coerces non-strings to "" — for the optional free-text fields only.
const asString = (value: unknown): string =>
	typeof value === "string" ? value : "";

// Event fetch (not global) so a relative API_BASE like /btcmap-api-proxy
// resolves server-side — same pattern as the other api/ routes.
export const POST: RequestHandler = async ({ request, fetch }) => {
	let body;
	try {
		body = await request.json();
	} catch {
		error(400, "Invalid request body");
	}

	if (!body || typeof body !== "object") {
		error(400, "Invalid request body");
	}

	if (body.honey) {
		error(418);
	}

	validateCaptcha(asString(body.captchaSecret), asString(body.captchaTest));

	// The submit token is server-held (Netlify env var); without it the
	// pipeline cannot work, so fail loudly rather than dropping submissions.
	if (!env.BTCMAP_IMPORT_TOKEN) {
		console.error("[submit-place] BTCMAP_IMPORT_TOKEN is not configured");
		error(503, "Service unavailable");
	}

	const name = asString(body.name).trim();
	const category = asString(body.category).trim();
	// Strict number check: Number(null) and Number("") are 0, which would
	// silently turn a null-ish coordinate into a valid-looking Null Island
	// submission instead of a 400.
	const lat: unknown = body.lat;
	const long: unknown = body.long;
	if (!name) error(400, "Name is required");
	if (!category) error(400, "Category is required");
	if (
		typeof lat !== "number" ||
		typeof long !== "number" ||
		!isValidLatitude(lat) ||
		!isValidLongitude(long)
	) {
		error(400, "Invalid coordinates");
	}

	const submission: AddLocationSubmission = {
		name,
		nameEn: asString(body.nameEn),
		address: asString(body.address),
		lat,
		long,
		category,
		methods: Array.isArray(body.methods) ? body.methods.map(asString) : [],
		website: asString(body.website),
		phone: asString(body.phone),
		hours: asString(body.hours),
		notes: asString(body.notes),
		source: asString(body.source),
		sourceOther: asString(body.sourceOther),
		contact: asString(body.contact),
	};

	const params = buildSubmitPlaceParams(submission, crypto.randomUUID());

	let response;
	try {
		response = await fetch(`${API_BASE}/rpc`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.BTCMAP_IMPORT_TOKEN}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: params.external_id,
				method: "submit_place",
				params,
			}),
			// Abort before Netlify's ~10s function kill so a hung upstream
			// surfaces as our logged 502, not an opaque platform timeout.
			signal: AbortSignal.timeout(8_000),
		});
	} catch (e) {
		console.error("[submit-place] RPC fetch failed", e);
		error(502, "Could not submit the location, please try again later.");
	}

	let rpcBody;
	let errorBody = "";
	if (response.ok) {
		try {
			rpcBody = await response.json();
		} catch {
			error(502, "Could not submit the location, please try again later.");
		}
	} else {
		errorBody = await response.text().catch(() => "");
		rpcBody = null;
	}

	if (!rpcBody || rpcBody.error || !rpcBody.result) {
		console.error(
			"[submit-place] RPC failure",
			response.status,
			rpcBody?.error,
			errorBody ? errorBody.slice(0, 500) : undefined,
		);
		error(502, "Could not submit the location, please try again later.");
	}

	return json({ id: rpcBody.result.id });
};
