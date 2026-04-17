import { error, isHttpError, redirect } from "@sveltejs/kit";

import { API_BASE } from "$lib/api-base";

import type { PageServerLoad } from "./$types";

// Temporarily disabled during maintenance
// import { getIssues } from '$lib/gitea';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { area, section } = params;

	// Validate area parameter format (alphanumeric, underscores, hyphens only)
	if (!/^[\w-]+$/.test(area)) {
		throw error(404, "Country Not Found");
	}

	// Validate section parameter - default to merchants if not provided
	const validSections = ["merchants", "stats", "activity", "maintain"];
	const currentSection = section || "merchants";

	if (!validSections.includes(currentSection)) {
		throw redirect(302, `/country/${encodeURIComponent(area)}/merchants`);
	}
	try {
		const areaResponse = await fetch(
			`${API_BASE}/v3/areas/${encodeURIComponent(area)}`,
		);

		if (!areaResponse.ok) {
			if (areaResponse.status === 404 || areaResponse.status === 410) {
				throw error(404, "Country Not Found");
			}
			throw error(502, "Upstream API error");
		}

		const fetchedArea = await areaResponse.json();

		// Check if area is deleted (v3 returns no tags for deleted areas)
		if (fetchedArea.deleted_at || !fetchedArea.tags) {
			throw error(404, "Country Not Found");
		}

		// Temporarily disabled during maintenance
		// const { issues: tickets } = await getIssues([fetchedArea.tags.url_alias]).catch(() => ({
		// 	issues: 'error'
		// }));
		const tickets = "maintenance";

		const issuesResponse = await fetch(`${API_BASE}/rpc`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "get_element_issues",
				params: {
					area_id: fetchedArea.id,
					limit: 10_000,
					offset: 0,
				},
			}),
		});

		const issues = await issuesResponse.json();

		return {
			id: fetchedArea.tags.url_alias,
			numericId: fetchedArea.id,
			name: fetchedArea.tags.name,
			tickets: tickets,
			issues: issues.result.requested_issues,
		};
	} catch (err) {
		console.error(err);
		if (isHttpError(err)) throw err;
		throw error(502, "Upstream API error");
	}
};
