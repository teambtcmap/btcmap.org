import crypto from "node:crypto";
import { error, json } from "@sveltejs/kit";

import { btcmapApiConfigured, submitPlaceFromPayload } from "$lib/btcmapApi";
import { GITEA_LABEL_NAMES } from "$lib/constants";
import { osmConfigured, pushToOsm } from "$lib/osm";
import { parseOsmPayloadBlock } from "$lib/osmPayload";

import type { RequestHandler } from "./$types";
import { env } from "$env/dynamic/private";

// Marker written into a comment after a successful push so re-delivered webhook
// events (or repeated label toggles) don't create duplicate OSM edits.
const PUSHED_MARKER = "<!--BTCMAP_OSM_PUSHED-->";

type GiteaLabel = { name: string };
type GiteaWebhookBody = {
	action?: string;
	issue?: {
		number: number;
		body: string;
		labels?: GiteaLabel[];
	};
	repository?: { full_name?: string; name?: string };
};

function verifySignature(rawBody: string, signature: string | null): boolean {
	if (!env.GITEA_WEBHOOK_SECRET) return false;
	if (!signature) return false;
	const expected = crypto
		.createHmac("sha256", env.GITEA_WEBHOOK_SECRET)
		.update(rawBody)
		.digest("hex");
	const a = Buffer.from(expected, "hex");
	const b = Buffer.from(signature, "hex");
	if (a.length !== b.length) return false;
	return crypto.timingSafeEqual(a, b);
}

function giteaHeaders(): Record<string, string> {
	return {
		Authorization: `token ${env.GITEA_API_KEY}`,
		"Content-Type": "application/json",
	};
}

async function issueHasPushedMarker(
	repoFullName: string,
	issueNumber: number,
): Promise<boolean> {
	const res = await fetch(
		`${env.GITEA_API_URL}/api/v1/repos/${repoFullName}/issues/${issueNumber}/comments`,
		{ headers: giteaHeaders() },
	);
	if (!res.ok) return false;
	const comments = (await res.json()) as Array<{ body?: string }>;
	return comments.some((c) => c.body?.includes(PUSHED_MARKER));
}

async function postComment(
	repoFullName: string,
	issueNumber: number,
	body: string,
): Promise<void> {
	await fetch(
		`${env.GITEA_API_URL}/api/v1/repos/${repoFullName}/issues/${issueNumber}/comments`,
		{ method: "POST", headers: giteaHeaders(), body: JSON.stringify({ body }) },
	);
}

export const POST: RequestHandler = async ({ request }) => {
	if (!env.GITEA_WEBHOOK_SECRET || !env.GITEA_API_URL || !env.GITEA_API_KEY) {
		error(503, "Webhook not configured");
	}

	const rawBody = await request.text();
	const signature = request.headers.get("X-Gitea-Signature");
	if (!verifySignature(rawBody, signature)) {
		error(401, "Invalid signature");
	}

	let payload: GiteaWebhookBody;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		error(400, "Invalid JSON");
	}

	const issue = payload.issue;
	const repoFullName = payload.repository?.full_name;
	if (!issue || !repoFullName) {
		return json({ ok: true, skipped: "no issue" });
	}

	// Only act once the maintainer approval label is present.
	const labels = (issue.labels ?? []).map((l) => l.name);
	if (!labels.includes(GITEA_LABEL_NAMES.APPROVED)) {
		return json({ ok: true, skipped: "not approved" });
	}

	const osmPayload = parseOsmPayloadBlock(issue.body ?? "");
	if (!osmPayload) {
		return json({ ok: true, skipped: "no osm payload" });
	}

	if (!btcmapApiConfigured() && !osmConfigured()) {
		error(503, "No push target configured");
	}

	// Guard against duplicate pushes from re-delivered events.
	if (await issueHasPushedMarker(repoFullName, issue.number)) {
		return json({ ok: true, skipped: "already pushed" });
	}

	const lines: string[] = [];
	try {
		// 1. Instant BTC Map draft via submit_place (create only; the import
		//    pipeline is not an OSM-node editor, so updates skip it).
		if (osmPayload.action === "create" && btcmapApiConfigured()) {
			const sp = await submitPlaceFromPayload(
				osmPayload,
				`gitea-${issue.number}`,
			);
			lines.push(
				`🗺️ Added to BTC Map instantly via submit_place (id \`${sp.id}\`, \`${sp.origin}:${sp.external_id}\`).`,
			);
		}

		// 2. Automated OSM changeset (create or update) via the bot account.
		if (osmConfigured()) {
			const result = await pushToOsm(osmPayload);
			const changesetUrl = result.url.replace(
				`/node/${result.osmId}`,
				`/changeset/${result.changesetId}`,
			);
			lines.push(
				`✅ Pushed to OSM: [${result.osmType}/${result.osmId}](${result.url}) in changeset [${result.changesetId}](${changesetUrl}).`,
			);
		}

		await postComment(
			repoFullName,
			issue.number,
			`${PUSHED_MARKER}\n${lines.join("\n")}`,
		);
		return json({ ok: true, results: lines });
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error("[gitea/webhook] push failed", message);
		await postComment(
			repoFullName,
			issue.number,
			`❌ Approval push failed: ${message}\n\n${
				lines.length ? `Completed before failure:\n${lines.join("\n")}\n\n` : ""
			}Please fix the payload and re-approve, or apply the change manually.`,
		);
		error(500, "Approval push failed");
	}
};
