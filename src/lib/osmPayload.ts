// Machine-readable OSM payload embedded in Gitea issue bodies.
//
// The add-location wizard emits this block so a maintainer can approve an issue
// and have api/gitea/webhook push it to OSM automatically — no manual copy/paste.
// The block is delimited by HTML comments so it stays invisible in Gitea's
// rendered markdown while remaining trivially parseable.

export const OSM_PAYLOAD_START = "<!--BTCMAP_OSM_PAYLOAD_START-->";
export const OSM_PAYLOAD_END = "<!--BTCMAP_OSM_PAYLOAD_END-->";

export type OsmPayloadAction = "create" | "update";

export type OsmPayload = {
	action: OsmPayloadAction;
	// Present for updates: the existing OSM element to edit.
	osmType?: "node" | "way" | "relation";
	osmId?: string;
	lat?: number;
	lon?: number;
	// Free-text merchant category (used by btcmap-api submit_place, which
	// requires it; not written to OSM as-is).
	category?: string;
	// OSM tags to set (create) or merge (update).
	tags: Record<string, string>;
};

const str = (v: unknown): string =>
	(v === undefined || v === null ? "" : String(v)).trim();

// Only assign a tag when the source value is non-empty, so we never write blank
// tags to OSM.
function setIf(
	tags: Record<string, string>,
	key: string,
	value: unknown,
): void {
	const v = str(value);
	if (v) tags[key] = v;
}

// Translate wizard form fields (loosely typed request body) into OSM tags.
function tagsFromData(data: Record<string, unknown>): Record<string, string> {
	const tags: Record<string, string> = {};

	setIf(tags, "name", data.name);
	setIf(tags, "name:en", data.nameEn);

	// Address: prefer a structured full address; fall back to a free-text
	// location description as a note so the maintainer keeps the context.
	setIf(tags, "addr:full", data.address);
	setIf(tags, "description", data.locationDescription);

	setIf(tags, "contact:website", data.website);
	setIf(tags, "contact:phone", data.phone);
	setIf(tags, "opening_hours", data.hours);
	setIf(tags, "contact:twitter", data.twitter);
	setIf(tags, "contact:facebook", data.facebook);
	setIf(tags, "contact:instagram", data.instagram);

	// Payment methods arrive as a comma-separated string ("onchain,lightning,nfc").
	const methods = str(data.methods)
		.split(",")
		.map((m) => m.trim())
		.filter(Boolean);
	if (methods.length) {
		tags["currency:XBT"] = "yes";
		if (methods.includes("onchain")) tags["payment:onchain"] = "yes";
		if (methods.includes("lightning")) tags["payment:lightning"] = "yes";
		if (methods.includes("nfc")) tags["payment:lightning_contactless"] = "yes";
	}

	// Record the survey date so downstream tooling sees a fresh check.
	tags["check_date"] = new Date().toISOString().slice(0, 10);

	return tags;
}

export function buildOsmPayload(
	action: OsmPayloadAction,
	data: Record<string, unknown>,
): OsmPayload {
	const payload: OsmPayload = {
		action,
		tags: tagsFromData(data),
	};

	const category = str(data.category);
	if (category) payload.category = category;

	// Guard against Number("") === 0, which would silently place a merchant at
	// 0,0 (the Gulf of Guinea) instead of treating coordinates as missing.
	const latText = str(data.lat);
	const lonText = str(data.long);
	const lat = latText === "" ? Number.NaN : Number(latText);
	const lon = lonText === "" ? Number.NaN : Number(lonText);
	if (Number.isFinite(lat)) payload.lat = lat;
	if (Number.isFinite(lon)) payload.lon = lon;

	if (action === "update") {
		const osmType = str(data.osmType) || "node";
		if (osmType === "node" || osmType === "way" || osmType === "relation") {
			payload.osmType = osmType;
		}
		const osmId = str(data.osmId);
		if (osmId) payload.osmId = osmId;
	}

	return payload;
}

export function buildOsmPayloadBlock(
	action: OsmPayloadAction,
	data: Record<string, unknown>,
): string {
	const payload = buildOsmPayload(action, data);
	const json = JSON.stringify(payload, null, 2);
	return `${OSM_PAYLOAD_START}\n\`\`\`json\n${json}\n\`\`\`\n${OSM_PAYLOAD_END}`;
}

// Extract and parse the payload block from a Gitea issue body. Returns null when
// no valid block is present.
export function parseOsmPayloadBlock(body: string): OsmPayload | null {
	const start = body.indexOf(OSM_PAYLOAD_START);
	const end = body.indexOf(OSM_PAYLOAD_END);
	if (start === -1 || end === -1 || end < start) return null;

	const between = body.slice(start + OSM_PAYLOAD_START.length, end);
	// Strip the ```json fences if present.
	const jsonText = between
		.replace(/```json/gi, "")
		.replace(/```/g, "")
		.trim();

	try {
		const parsed = JSON.parse(jsonText) as OsmPayload;
		if (
			!parsed ||
			(parsed.action !== "create" && parsed.action !== "update") ||
			typeof parsed.tags !== "object"
		) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}
