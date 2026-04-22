// Shared domain types, constants, and helpers for the place-activity
// feed. Consumed by:
// - src/routes/user/activity/+page.svelte (combined saved-items feed)
// - src/components/area/AreaFeed.svelte (per-area feed)
// - src/components/activity/ActivityCard.svelte (single-item renderer)
// - src/components/activity/ActivityTypeFilter.svelte (chip row)

export type ActivityType =
	| "place_added"
	| "place_updated"
	| "place_deleted"
	| "place_commented"
	| "place_boosted";

export type ActivityItem = {
	type: ActivityType;
	place_id: number;
	place_name?: string;
	osm_user_id?: number;
	osm_user_name?: string;
	comment?: string;
	duration_days?: number;
	date: string;
};

export const ACTIVITY_TYPES: ActivityType[] = [
	"place_added",
	"place_updated",
	"place_deleted",
	"place_commented",
	"place_boosted",
];

export const DOT_COLORS: Record<ActivityType, string> = {
	place_commented: "bg-amber-500",
	place_boosted: "bg-orange-500",
	place_added: "bg-created",
	place_deleted: "bg-deleted",
	place_updated: "bg-link",
};

export const TYPE_LABEL_KEYS: Record<ActivityType, string> = {
	place_added: "userActivity.typeAdded",
	place_updated: "userActivity.typeUpdated",
	place_deleted: "userActivity.typeDeleted",
	place_commented: "userActivity.typeCommented",
	place_boosted: "userActivity.typeBoosted",
};

export const dotColor = (type: ActivityType): string =>
	DOT_COLORS[type] ?? "bg-link";

export function emptyTypeCounts(): Record<ActivityType, number> {
	return {
		place_added: 0,
		place_updated: 0,
		place_deleted: 0,
		place_commented: 0,
		place_boosted: 0,
	};
}

export function countByType(
	items: readonly ActivityItem[],
): Record<ActivityType, number> {
	const counts = emptyTypeCounts();
	for (const item of items) counts[item.type]++;
	return counts;
}
