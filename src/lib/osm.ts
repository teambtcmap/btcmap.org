// Minimal OSM API 0.6 client for the approve-and-push flow.
//
// Server-only. Authenticates with an OAuth 2.0 bearer token belonging to a
// dedicated BTC Map bot account. Everything is gated behind osmConfigured() so
// the site runs fine without OSM credentials — the push simply stays disabled.

import type { OsmPayload } from "$lib/osmPayload";

import { env } from "$env/dynamic/private";

const DEFAULT_API_BASE = "https://api.openstreetmap.org";

export function osmConfigured(): boolean {
	return Boolean(env.OSM_OAUTH_TOKEN);
}

function apiBase(): string {
	return (env.OSM_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
}

function authHeaders(
	extra: Record<string, string> = {},
): Record<string, string> {
	return {
		Authorization: `Bearer ${env.OSM_OAUTH_TOKEN}`,
		...extra,
	};
}

function xmlEscape(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

function tagsToXml(tags: Record<string, string>): string {
	return Object.entries(tags)
		.filter(([, v]) => v !== undefined && v !== null && String(v) !== "")
		.map(
			([k, v]) => `    <tag k="${xmlEscape(k)}" v="${xmlEscape(String(v))}"/>`,
		)
		.join("\n");
}

async function osmRequest(
	method: string,
	path: string,
	body?: string,
): Promise<string> {
	const response = await fetch(`${apiBase()}${path}`, {
		method,
		headers: authHeaders(body ? { "Content-Type": "text/xml" } : {}),
		body,
	});
	const text = await response.text();
	if (!response.ok) {
		throw new Error(
			`OSM ${method} ${path} failed (${response.status}): ${text}`,
		);
	}
	return text;
}

async function createChangeset(comment: string): Promise<string> {
	const xml = `<osm>
  <changeset>
    <tag k="created_by" v="BTC Map wizard"/>
    <tag k="comment" v="${xmlEscape(comment)}"/>
    <tag k="source" v="survey"/>
  </changeset>
</osm>`;
	const id = await osmRequest("PUT", "/api/0.6/changeset/create", xml);
	return id.trim();
}

async function closeChangeset(id: string): Promise<void> {
	await osmRequest("PUT", `/api/0.6/changeset/${id}/close`);
}

// Parse the bits we need out of a node's XML representation. Deliberately small:
// we only read version, coordinates and existing tags so an update can merge
// without dropping data (a full-element upload replaces all tags).
type ParsedNode = {
	version: string;
	lat: string;
	lon: string;
	tags: Record<string, string>;
};

function parseNodeXml(xml: string): ParsedNode {
	const nodeMatch = xml.match(/<node\b[^>]*>/);
	const attrs = nodeMatch ? nodeMatch[0] : "";
	const attr = (name: string): string => {
		const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
		return m ? m[1] : "";
	};
	const tags: Record<string, string> = {};
	const tagRe = /<tag\s+k="([^"]*)"\s+v="([^"]*)"\s*\/>/g;
	let m: RegExpExecArray | null;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
	while ((m = tagRe.exec(xml)) !== null) {
		tags[decodeXml(m[1])] = decodeXml(m[2]);
	}
	return {
		version: attr("version"),
		lat: attr("lat"),
		lon: attr("lon"),
		tags,
	};
}

function decodeXml(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

async function fetchNode(osmId: string): Promise<ParsedNode> {
	const xml = await osmRequest("GET", `/api/0.6/node/${osmId}`);
	return parseNodeXml(xml);
}

export type OsmPushResult = {
	changesetId: string;
	osmType: "node";
	osmId: string;
	url: string;
};

// Create a new node or merge tags into an existing one, then close the changeset.
export async function pushToOsm(payload: OsmPayload): Promise<OsmPushResult> {
	if (!osmConfigured()) {
		throw new Error("OSM push not configured (missing OSM_OAUTH_TOKEN)");
	}

	if (payload.action === "update") {
		if (payload.osmType && payload.osmType !== "node") {
			// Ways/relations need geometry handling we intentionally don't do here.
			throw new Error(
				`Unsupported OSM element type for push: ${payload.osmType}`,
			);
		}
		if (!payload.osmId) throw new Error("Update payload missing osmId");
	}
	if (payload.action === "create") {
		if (!Number.isFinite(payload.lat) || !Number.isFinite(payload.lon)) {
			throw new Error("Create payload missing coordinates");
		}
	}

	const name = payload.tags.name || "merchant";
	const changesetId = await createChangeset(
		payload.action === "create"
			? `Add bitcoin-accepting merchant "${name}" (via BTC Map)`
			: `Update bitcoin-accepting merchant "${name}" (via BTC Map)`,
	);

	try {
		if (payload.action === "create") {
			const xml = `<osm>
  <node changeset="${changesetId}" lat="${payload.lat}" lon="${payload.lon}">
${tagsToXml(payload.tags)}
  </node>
</osm>`;
			const newId = (
				await osmRequest("PUT", "/api/0.6/node/create", xml)
			).trim();
			await closeChangeset(changesetId);
			return {
				changesetId,
				osmType: "node",
				osmId: newId,
				url: `${apiBase()}/node/${newId}`,
			};
		}

		// update: fetch current node, merge tags, upload with same version.
		const osmId = payload.osmId as string;
		const existing = await fetchNode(osmId);
		const mergedTags = { ...existing.tags, ...payload.tags };
		const lat = Number.isFinite(payload.lat) ? payload.lat : existing.lat;
		const lon = Number.isFinite(payload.lon) ? payload.lon : existing.lon;
		const xml = `<osm>
  <node id="${osmId}" changeset="${changesetId}" version="${existing.version}" lat="${lat}" lon="${lon}">
${tagsToXml(mergedTags)}
  </node>
</osm>`;
		await osmRequest("PUT", `/api/0.6/node/${osmId}`, xml);
		await closeChangeset(changesetId);
		return {
			changesetId,
			osmType: "node",
			osmId,
			url: `${apiBase()}/node/${osmId}`,
		};
	} catch (err) {
		// Best-effort cleanup so we don't leave an open changeset dangling.
		try {
			await closeChangeset(changesetId);
		} catch {
			// ignore
		}
		throw err;
	}
}
