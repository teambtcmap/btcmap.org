import { error, json } from "@sveltejs/kit";

import type { AddLocationSubmission } from "$lib/placeSubmission";
import { buildSubmitPlaceParams } from "$lib/placeSubmission";
import { validateCaptcha } from "$lib/server/captcha";
import { isValidLatitude, isValidLongitude } from "$lib/utils";

import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";

const str = (value: unknown): string =>
	typeof value === "string" ? value : "";

export const POST: RequestHandler = async ({ request }) => {
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

	validateCaptcha(str(body.captchaSecret), str(body.captchaTest));

	// The submit token is server-held (Netlify env var); without it the
	// pipeline cannot work, so fail loudly rather than dropping submissions.
	if (!env.BTCMAP_API_TOKEN) {
		console.error("[submit-place] BTCMAP_API_TOKEN is not configured");
		error(503, "Service unavailable");
	}

	const name = str(body.name).trim();
	const category = str(body.category).trim();
	const lat = Number(body.lat);
	const long = Number(body.long);
	if (!name) error(400, "Name is required");
	if (!category) error(400, "Category is required");
	if (!isValidLatitude(lat) || !isValidLongitude(long)) {
		error(400, "Invalid coordinates");
	}

	const submission: AddLocationSubmission = {
		name,
		nameEn: str(body.nameEn),
		address: str(body.address),
		lat,
		long,
		category,
		methods: Array.isArray(body.methods) ? body.methods.map(str) : [],
		website: str(body.website),
		phone: str(body.phone),
		hours: str(body.hours),
		notes: str(body.notes),
		source: str(body.source),
		sourceOther: str(body.sourceOther),
		contact: str(body.contact),
	};

	const params = buildSubmitPlaceParams(submission, crypto.randomUUID());
	const rpcUrl = env.BTCMAP_API_RPC_URL || "https://api.btcmap.org/rpc";

	let response;
	try {
		response = await fetch(rpcUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${env.BTCMAP_API_TOKEN}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: params.external_id,
				method: "submit_place",
				params,
			}),
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
