import { error } from "@sveltejs/kit";
import { get } from "svelte/store";

import { GITEA_LABELS } from "$lib/constants";
import { createIssueWithLabels, type GiteaRepo } from "$lib/gitea";
import { validateCaptcha } from "$lib/server/captcha";
import { areas } from "$lib/store";
import { getAreaIdsByCoordinates } from "$lib/utils";

import type { RequestHandler } from "./$types";

type IssueConfig = {
	repo: GiteaRepo;
	labelId: number;
	hasAreaLabels: boolean;
};

const CONFIG = {
	"add-location": {
		repo: "btcmap-data",
		labelId: GITEA_LABELS.DATA.ADD_LOCATION,
		hasAreaLabels: true,
	},
	"verify-location": {
		repo: "btcmap-data",
		labelId: GITEA_LABELS.DATA.VERIFY_LOCATION,
		hasAreaLabels: true,
	},
	community: {
		repo: "btcmap-data",
		labelId: GITEA_LABELS.DATA.COMMUNITY_SUBMISSION,
		hasAreaLabels: false,
	},
	"verify-community": {
		repo: "btcmap-data",
		labelId: GITEA_LABELS.DATA.VERIFY_COMMUNITY,
		hasAreaLabels: false,
	},
	"tagger-onboarding": {
		repo: "btcmap-infra",
		labelId: GITEA_LABELS.INFRA.TAGGER_ONBOARDING,
		hasAreaLabels: false,
	},
} satisfies Record<string, IssueConfig>;

type IssueType = keyof typeof CONFIG;

function isValidIssueType(type: unknown): type is IssueType {
	return typeof type === "string" && type in CONFIG;
}

async function getAreaLabelsFromCoordinates(
	lat: number,
	long: number,
): Promise<{ labels: string[]; text: string }> {
	const associatedAreaIds = await getAreaIdsByCoordinates(lat, long);
	const areasData = get(areas);
	const filteredAreas = associatedAreaIds
		.map((id) => areasData.find((a) => a.id === id))
		.filter(Boolean);

	const labels = filteredAreas
		.map((area) => area?.tags?.url_alias || area?.id)
		.filter((label): label is string => Boolean(label));

	const text = filteredAreas
		.map((area) => `${area?.tags?.name} (${area?.tags?.url_alias || area?.id})`)
		.join(", ");

	return { labels, text };
}

function generateBody(
	type: IssueType,
	data: Record<string, unknown>,
	areasText: string,
): string {
	const timestamp = new Date(Date.now()).toISOString();
	const taggingInstructions = `If you are a new contributor please read our Tagging Instructions [here](https://wiki.btcmap.org/Tagging-Merchants).`;

	switch (type) {
		case "add-location":
			return `Merchant name: ${data.name}
English name (name:en): ${data.nameEn || ""}
Address: ${data.address}
Lat: ${data.lat}
Long: ${data.long}
Associated areas: ${areasText}
OSM: ${data.osm}
Category: ${data.category}
Payment methods: ${data.methods}
Website: ${data.website}
Phone: ${data.phone}
Opening hours: ${data.hours}
Notes: ${data.notes}
Data Source: ${data.source}
Details (if applicable): ${data.sourceOther}
Contact: ${data.contact}
Created at: ${timestamp}

${taggingInstructions}`;

		case "verify-location":
			return `Merchant name: ${data.name}
Merchant location: ${data.location}
Coordinates: ${data.lat}, ${data.long}
Associated areas: ${areasText}
Edit link: ${data.edit}
Current information correct: ${data.current}
Outdated information: ${data.outdated}
How did you verify this?: ${data.verified}
Created at: ${timestamp}

${taggingInstructions}`;

		case "community":
			return `Community name: ${data.name}
Location: ${data.location}
GeoJSON: https://geojson.codingarena.top/?search=${encodeURIComponent(String(data.location))}
Icon URL: ${data.icon}
Lightning: ${data.lightning}
Social links: ${data.socialLinks}
Community leader contact: ${data.contact}
Notes: ${data.notes}
Created at: ${timestamp}`;

		case "verify-community":
			return `Community name: ${data.name}
Community page: ${data.communityUrl}
Information is accurate: ${data.accurate}
Updates needed: ${data.updates || "None"}
How did you verify this?: ${data.verified}
Created at: ${timestamp}`;

		case "tagger-onboarding":
			return `Name: ${data.name}
Email: ${data.email}
Created at: ${timestamp}

New tagger onboarding request.`;

		default:
			error(400, "Invalid issue type");
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const { type, captchaSecret, captchaTest, honey, ...data } =
		await request.json();

	console.debug("[gitea/issue] Processing request", {
		type,
		hasData: !!data.name,
	});

	if (honey) {
		console.debug("[gitea/issue] Honeypot triggered");
		error(418);
	}

	if (!isValidIssueType(type)) {
		console.debug("[gitea/issue] Invalid issue type", { type });
		error(400, "Invalid issue type");
	}

	validateCaptcha(captchaSecret, captchaTest);

	// type is now narrowed to IssueType after validation
	const config = CONFIG[type];
	let areaLabels: string[] = [];
	let areasText = "";

	if (config.hasAreaLabels && data.lat && data.long) {
		console.debug("[gitea/issue] Fetching area labels", {
			lat: data.lat,
			long: data.long,
		});
		const areaData = await getAreaLabelsFromCoordinates(data.lat, data.long);
		areaLabels = areaData.labels;
		areasText = areaData.text;
		console.debug("[gitea/issue] Area labels resolved", {
			count: areaLabels.length,
		});
	}

	const body = generateBody(type, data, areasText);
	const title = String(data.name);

	console.debug("[gitea/issue] Creating issue", {
		type,
		repo: config.repo,
		title,
	});

	const response = await createIssueWithLabels(
		title,
		body,
		[config.labelId],
		config.repo,
		areaLabels,
	);

	console.debug("[gitea/issue] Issue created", {
		issueNumber: response.data.number,
	});

	return new Response(JSON.stringify(response.data));
};
