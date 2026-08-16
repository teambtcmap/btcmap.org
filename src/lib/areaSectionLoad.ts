import { error, isHttpError, redirect } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import { extractContacts } from "$lib/area/contacts";
import type { AreaPageProps, AreaTags, PlaceIssue } from "$lib/types";

// Shared loader for the community/[area]/[section] and country/[area]/[section]
// pages. Both fetch the same v3 area data and share the same error handling;
// they differ only in how the area slug is validated, which tags an area must
// carry to be renderable, the not-found copy, and the redirect base path.
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
	redirectBase: string;
	isValidArea: (area: string) => boolean;
	// The tags an area must carry to be renderable by AreaPage. This used to
	// be a client-side $areas-lookup filter that ended in goto("/404") — after
	// the 5.7 MB crawl. A malformed area now 404s at SSR time instead.
	hasRequiredTags: (tags: AreaTags) => boolean;
};

export type AreaSectionResult = {
	// The shared AreaPage data; the community route additionally derives
	// verifiedDate/iconSquare from `tags` below (both optional on AreaPageProps).
	data: Omit<AreaPageProps, "verifiedDate" | "iconSquare">;
	tags: AreaTags;
};

const VALID_SECTIONS = ["merchants", "stats", "activity", "maintain"];

// Place-issues are consumed only by the maintain section's IssuesTable —
// the other sections' SSR payloads must not carry up to ~150 KB of issue
// rows (the US) they never render. Section navigation re-runs this loader,
// so landing on /maintain fetches them then.
const SECTIONS_WITH_ISSUES = new Set(["maintain"]);

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
	sectionParam: string,
): Promise<AreaSectionResult> => {
	const { area } = params;
	const section = sectionParam || "merchants";

	if (!config.isValidArea(area)) {
		throw error(404, config.notFoundMessage);
	}

	if (!VALID_SECTIONS.includes(section)) {
		throw redirect(
			302,
			`${config.redirectBase}/${encodeURIComponent(area)}/merchants`,
		);
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

		return {
			data: {
				id: tags.url_alias,
				numericId: fetchedArea.id,
				name: tags.name,
				tickets: tickets,
				issues,
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
