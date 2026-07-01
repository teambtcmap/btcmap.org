import { error, isHttpError, redirect } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";
import type { AreaPageProps, AreaTags } from "$lib/types";

// Shared loader for the community/[area]/[section] and country/[area]/[section]
// pages. Both fetch the same v3 area + v4 place-issues data and share the same
// error handling; they differ only in how the area slug is validated, the
// not-found copy, and the redirect base path.

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

type AreaSectionEvent = {
	params: { area: string; section: string };
	fetch: FetchLike;
};

export type AreaSectionConfig = {
	notFoundMessage: string;
	redirectBase: string;
	isValidArea: (area: string) => boolean;
};

export type AreaSectionResult = {
	// The shared AreaPage data; the community route additionally derives
	// verifiedDate/iconSquare from `tags` below (both optional on AreaPageProps).
	data: Omit<AreaPageProps, "verifiedDate" | "iconSquare">;
	tags: AreaTags;
};

const VALID_SECTIONS = ["merchants", "stats", "activity", "maintain"];

export const loadAreaSection = async (
	{ params, fetch }: AreaSectionEvent,
	config: AreaSectionConfig,
): Promise<AreaSectionResult> => {
	const { area } = params;
	const section = params.section || "merchants";

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

		// Ticket syncing is temporarily disabled during maintenance
		const tickets = "maintenance";

		const issuesResponse = await fetch(
			`${API_BASE}/v4/place-issues?area_id=${fetchedArea.id}&limit=10000&offset=0`,
		);

		if (!issuesResponse.ok) {
			throw error(502, "Upstream API error");
		}

		const issues = await issuesResponse.json();

		return {
			data: {
				id: fetchedArea.tags.url_alias,
				numericId: fetchedArea.id,
				name: fetchedArea.tags.name,
				tickets: tickets,
				issues: issues.requested_issues,
				description: fetchedArea.tags.description,
			},
			tags: fetchedArea.tags,
		};
	} catch (err) {
		console.error(err);
		if (isHttpError(err)) throw err;
		throw error(502, "Upstream API error");
	}
};
