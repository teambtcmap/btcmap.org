import { error, isHttpError } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import { extractContacts } from "$lib/area/contacts";
import type {
	AreaEvent,
	AreaPageProps,
	AreaTags,
	PlaceIssue,
} from "$lib/types";

// Shared loader for the community/[area]/<section> and country/[area]/<section>
// literal-section routes (merchants, stats, activity, maintain). Both fetch
// the same v3 area data and share the same error handling; they differ only
// in how the area slug is validated, which tags an area must carry to be
// renderable, and the not-found copy.
//
// The returned bundle carries the FULL tags (including the geo_json polygon)
// so the client never has to re-download the multi-MB world areas crawl just
// to recover a polygon this fetch already had (#1174).

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type AreaSectionEvent = {
	params: { area: string };
	fetch: FetchLike;
};

export type AreaSectionConfig = {
	notFoundMessage: string;
	isValidArea: (area: string) => boolean;
	// The tags an area must carry to be renderable by the section pages. This
	// used to be a client-side $areas-lookup filter that ended in
	// goto("/404") — after the 5.7 MB crawl. A malformed area now 404s at
	// SSR time instead.
	hasRequiredTags: (tags: AreaTags) => boolean;
};

export type AreaSectionResult = {
	// The shared area section data; the community route additionally derives
	// verifiedDate/iconSquare from `tags` below (both optional on AreaPageProps).
	data: Omit<AreaPageProps, "verifiedDate" | "iconSquare">;
	tags: AreaTags;
};

// One source of truth: the section id IS the route directory IS the
// i18n key suffix. The union makes a bogus section uncompilable at
// every loader call site.
export const AREA_SECTIONS = [
	"merchants",
	"events",
	"stats",
	"activity",
	"maintain",
] as const;
export type AreaSection = (typeof AREA_SECTIONS)[number];

// Place-issues are consumed only by the maintain section's IssuesTable —
// the other sections' SSR payloads must not carry up to ~150 KB of issue
// rows (the US) they never render. Section navigation re-runs this loader,
// so landing on /maintain fetches them then.
const SECTIONS_WITH_ISSUES = new Set(["maintain"]);

// Bitcoin meetups and conferences inside the area polygon, fetched on
// every section because the events tab badge needs the future-event count
// regardless of which tab is active. The /v4 API window is "365 days back
// + all future" so the events section can render a coherent list AND the
// layout can read the future count for its badge from the same payload.
// On non-events sections an upstream hiccup degrades to [] so an
// events-endpoint outage can't take down merchants/stats/activity/maintain
// — the badge then shows (0) until the endpoint recovers. The events
// section itself still 502s on upstream errors since it's the section
// that actually needs the payload to render anything.
const EVENTS_WINDOW_DAYS = 365;

const ISSUES_PAGE_LIMIT = 10000;
// Backstop against a runaway loop, far above any real area today. If an
// area ever exceeds it, we log the truncation instead of hiding it.
const ISSUES_MAX_PAGES = 10;

const fetchAllPlaceIssues = async (
	fetch: FetchLike,
	areaId: number,
): Promise<PlaceIssue[]> => {
	const all: PlaceIssue[] = [];
	for (let page = 0; page < ISSUES_MAX_PAGES; page++) {
		const response = await fetch(
			`${API_BASE}/v4/place-issues?area_id=${areaId}&limit=${ISSUES_PAGE_LIMIT}&offset=${page * ISSUES_PAGE_LIMIT}`,
		);
		if (!response.ok) {
			throw error(502, "Upstream API error");
		}
		const body = await response.json();
		// A malformed payload (missing/non-array requested_issues) is an
		// upstream schema break, not an empty page — surfacing it beats
		// silently rendering an empty maintain table.
		if (!Array.isArray(body?.requested_issues)) {
			throw error(502, "Upstream API error");
		}
		const rows: PlaceIssue[] = body.requested_issues;
		all.push(...rows);
		// A short page means we've seen the tail; the old single-shot
		// `offset=0` silently truncated anything past the first 10k.
		if (rows.length < ISSUES_PAGE_LIMIT) return all;
	}
	console.warn(
		`place-issues for area ${areaId} truncated at ${all.length} rows`,
	);
	return all;
};

// Window covers "the last 365 days" plus everything in the future. The
// API's default `from` is now-UTC, so we lower it by the window size; the
// `to` defaults to year 2200 which is already past any plausible event,
// so we leave it alone.
//
// `strict` controls whether an upstream hiccup throws a 502 (the events
// section, which actually renders the list) or degrades to an empty
// array (every other section, which only consumes the count for the
// events tab badge). 404 still maps to [] in both modes — the API uses
// it to mean the area alias itself is unknown upstream.
const fetchAreaEvents = async (
	fetch: FetchLike,
	areaAlias: string,
	strict: boolean,
): Promise<AreaEvent[]> => {
	const from = new Date(
		Date.now() - EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
	).toISOString();
	try {
		const response = await fetch(
			`${API_BASE}/v4/areas/${encodeURIComponent(areaAlias)}/events?from=${encodeURIComponent(from)}`,
		);
		// 404 means the area alias itself is unknown upstream — treat as no
		// events in both modes; a real area miss is handled by the section's
		// own 404 path.
		if (response.status === 404) return [];
		if (!response.ok)
			throw new Error(`events endpoint returned ${response.status}`);
		const body = await response.json();
		if (!Array.isArray(body)) throw new Error("events payload is not an array");
		return body as AreaEvent[];
	} catch (err) {
		// Any failure — a rejected fetch (transport), a rejected json()
		// (invalid JSON), an upstream error status or a malformed payload —
		// degrades to [] off the events section so a hiccup on
		// /v4/areas/{alias}/events can't 502 merchants/stats/activity/maintain.
		// The events section itself, which renders the list, still surfaces
		// the 502.
		if (!strict) return [];
		if (isHttpError(err)) throw err;
		throw error(502, "Upstream API error");
	}
};

// box:* tags are human-authored camera hints, served as numbers despite
// their string typing — coerce and validate. They are CAMERA-ONLY, never
// containment: a stale or too-small box must not be able to drop real
// merchants (#1175 owns the geometry-derived, antimeridian-aware bbox for
// containment). Wrap boxes (west > east) fall back to the client's
// polygon-derived fit rather than guessing a convention here.
const cameraBboxFromTags = (
	tags: AreaTags,
): [number, number, number, number] | null => {
	const west = Number(tags["box:west"]);
	const south = Number(tags["box:south"]);
	const east = Number(tags["box:east"]);
	const north = Number(tags["box:north"]);
	if (![west, south, east, north].every(Number.isFinite)) return null;
	// Out-of-range coordinates must fail closed too: MapLibre's LngLat
	// throws on latitudes beyond ±90 (crashing fitBounds mid-init), and
	// longitudes beyond ±180 silently misplace the camera.
	if (Math.abs(south) > 90 || Math.abs(north) > 90) return null;
	if (Math.abs(west) > 180 || Math.abs(east) > 180) return null;
	if (south >= north || west >= east) return null;
	return [west, south, east, north];
};

export const loadAreaSection = async (
	{ params, fetch }: AreaSectionEvent,
	config: AreaSectionConfig,
	section: AreaSection,
): Promise<AreaSectionResult> => {
	const { area } = params;

	if (!config.isValidArea(area)) {
		throw error(404, config.notFoundMessage);
	}

	try {
		const areaResponse = await fetch(
			`${API_BASE}/v3/areas/${encodeURIComponent(area)}`,
		);

		if (!areaResponse.ok) {
			if (areaResponse.status === 404 || areaResponse.status === 410) {
				throw error(404, config.notFoundMessage);
			}
			throw error(502, "Upstream API error");
		}

		const fetchedArea = await areaResponse.json();

		// v3 returns no tags for deleted areas
		if (fetchedArea.deleted_at || !fetchedArea.tags) {
			throw error(404, config.notFoundMessage);
		}

		const tags: AreaTags = fetchedArea.tags;

		// url_alias is a loader invariant, not a per-type config concern:
		// data.id derives from it and feeds avatars, section links, and the
		// top-editors fetch — an area without one is unrenderable.
		if (!tags.url_alias || !config.hasRequiredTags(tags)) {
			throw error(404, config.notFoundMessage);
		}

		// Ticket syncing is temporarily disabled during maintenance
		const tickets = "maintenance";

		const issues = SECTIONS_WITH_ISSUES.has(section)
			? await fetchAllPlaceIssues(fetch, fetchedArea.id)
			: [];

		// Fetched for every section — the events tab badge reads the
		// future-event count from `data.events` on every layout, not just
		// on the events tab itself. Only the events section itself 502s on
		// upstream errors; everywhere else the fetch degrades to [] so a
		// hiccup on /v4/areas/{alias}/events can't take down merchants,
		// stats, activity or maintain for the whole area.
		const events = await fetchAreaEvents(
			fetch,
			tags.url_alias,
			section === "events",
		);

		return {
			data: {
				id: tags.url_alias,
				numericId: fetchedArea.id,
				name: tags.name,
				tickets: tickets,
				issues,
				events,
				description: tags.description,
				tags,
				contacts: extractContacts(tags),
				cameraBbox: cameraBboxFromTags(tags),
			},
			tags,
		};
	} catch (err) {
		console.error(err);
		if (isHttpError(err)) throw err;
		throw error(502, "Upstream API error");
	}
};
