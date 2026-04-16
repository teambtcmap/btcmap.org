import { error, redirect } from "@sveltejs/kit";

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
			`https://api.btcmap.org/v3/areas/${encodeURIComponent(area)}`,
		);

		if (!areaResponse.ok) {
			throw error(404, "Country Not Found");
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

		const issuesResponse = await fetch("https://api.btcmap.org/rpc", {
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
		throw error(404, "Country Not Found");
	}
};
