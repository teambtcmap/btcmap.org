import { error, isHttpError, redirect } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

// Temporarily disabled during maintenance
// import { getIssues } from '$lib/gitea';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const { area, section } = params;

	// Allow non-Latin aliases while still rejecting malformed path-like values.
	if (area.includes("/")) {
		throw error(404, "Community Not Found");
	}

	// Validate section parameter
	const validSections = ["merchants", "stats", "activity", "maintain"];
	if (!validSections.includes(section)) {
		throw redirect(302, `/community/${encodeURIComponent(area)}/merchants`);
	}
	try {
		const areaResponse = await fetch(
			`https://api.btcmap.org/v3/areas/${encodeURIComponent(area)}`,
		);

		if (!areaResponse.ok) {
			if (areaResponse.status === 404 || areaResponse.status === 410) {
				throw error(404, "Community Not Found");
			}
			throw error(502, "Upstream API error");
		}

		const fetchedArea = await areaResponse.json();

		// Check if area is deleted (v3 returns no tags for deleted areas)
		if (fetchedArea.deleted_at || !fetchedArea.tags) {
			throw error(404, "Community Not Found");
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
			verifiedDate: fetchedArea.tags["verified:date"],
		};
	} catch (err) {
		console.error(err);
		if (isHttpError(err)) throw err;
		throw error(502, "Upstream API error");
	}
};
