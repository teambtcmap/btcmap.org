<script lang="ts">
import { onMount } from "svelte";
import Time from "svelte-time";

import type { FormSelectOption } from "$components/form/FormSelect.svelte";
import FormSelect from "$components/form/FormSelect.svelte";
import Icon from "$components/Icon.svelte";
import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";
import { _ } from "$lib/i18n";
import { session } from "$lib/session";

import { goto } from "$app/navigation";
import { resolve } from "$app/paths";

type ActivityType =
	| "place_added"
	| "place_updated"
	| "place_deleted"
	| "place_commented"
	| "place_boosted";

type ActivityItem = {
	type: ActivityType;
	place_id: number;
	place_name?: string;
	osm_user_id?: number;
	osm_user_name?: string;
	comment?: string;
	duration_days?: number;
	date: string;
};

type SavedPlace = { id: number; name: string };
type SavedArea = { id: number; name: string };

type Filter =
	| { kind: "all" }
	| { kind: "place"; id: number }
	| { kind: "area"; id: number };

const DAYS = 30;
const PAGE_SIZE = 20;
// Mirrors the server-side cap in /v4/activity — slice here so a user
// with 500+ saved places still gets a usable response instead of a 400.
const MAX_PLACES = 500;

const ACTIVITY_TYPES: ActivityType[] = [
	"place_added",
	"place_updated",
	"place_deleted",
	"place_commented",
	"place_boosted",
];

const DOT_COLORS: Record<ActivityType, string> = {
	place_commented: "bg-amber-500",
	place_boosted: "bg-orange-500",
	place_added: "bg-created",
	place_deleted: "bg-deleted",
	place_updated: "bg-link",
};

const TYPE_LABEL_KEYS: Record<ActivityType, string> = {
	place_added: "userActivity.typeAdded",
	place_updated: "userActivity.typeUpdated",
	place_deleted: "userActivity.typeDeleted",
	place_commented: "userActivity.typeCommented",
	place_boosted: "userActivity.typeBoosted",
};

const dotColor = (type: ActivityType) => DOT_COLORS[type];

// IDs come from the session (always available once logged in).
// Names are fetched from the API best-effort for the filter select —
// if that fetch fails the feed still works.
let savedPlaceIds: number[] = [];
let savedAreaIds: number[] = [];
let placeNames: Map<number, string> = new Map();
let areaNames: Map<number, string> = new Map();
let hasSavedItems = false;
// filterValue is the select's string value ("all" | "place:<id>" |
// "area:<id>"); `filter` is the parsed typed view used by buildFeedUrl.
let filterValue = "all";
let activeTypes: Set<ActivityType> = new Set(ACTIVITY_TYPES);
let feedItems: ActivityItem[] = [];
let page = 0;
let initialLoading = true;
let feedLoading = false;
let feedError = false;
let fetchGeneration = 0;

$: filter = parseFilterValue(filterValue);
// Counts are over the unfiltered window so chip counts don't collapse
// when the user toggles a type off. Prefill every key with 0 so the
// record is fully populated and the chip template can read
// `typeCounts[type]` without a fallback.
$: typeCounts = ((): Record<ActivityType, number> => {
	const counts: Record<ActivityType, number> = {
		place_added: 0,
		place_updated: 0,
		place_deleted: 0,
		place_commented: 0,
		place_boosted: 0,
	};
	for (const item of feedItems) counts[item.type]++;
	return counts;
})();
$: visibleItems = feedItems.filter((i) => activeTypes.has(i.type));
$: pagedItems = visibleItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
$: totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));
// Suppress the "(0)" suffix on every chip during the very first load,
// where typeCounts is uniformly zero and a chipful of zeros looks like
// "there's nothing to filter". After the initial fetch resolves we
// always show counts, even if some are legitimately 0.
$: showChipCounts = !(feedLoading && !feedItems.length);

function toggleType(type: ActivityType) {
	const next = new Set(activeTypes);
	if (next.has(type)) next.delete(type);
	else next.add(type);
	activeTypes = next;
	page = 0;
}

// Rebuild options when saved-id lists, hydrated names, or locale change.
$: filterOptions = ((): FormSelectOption[] => {
	const opts: FormSelectOption[] = [
		{ value: "all", label: $_("userActivity.filterAll") },
	];
	const placesLabel = $_("userActivity.filterPlaces");
	const areasLabel = $_("userActivity.filterAreas");
	for (const id of savedPlaceIds) {
		opts.push({
			value: `place:${id}`,
			label:
				placeNames.get(id) ||
				$_("userActivity.placeFallback", { values: { id } }),
			group: placesLabel,
		});
	}
	for (const id of savedAreaIds) {
		opts.push({
			value: `area:${id}`,
			label:
				areaNames.get(id) ||
				$_("userActivity.areaFallback", { values: { id } }),
			group: areasLabel,
		});
	}
	return opts;
})();

function parseFilterValue(v: string): Filter {
	if (v.startsWith("place:")) {
		const id = Number(v.slice(6));
		return Number.isFinite(id) ? { kind: "place", id } : { kind: "all" };
	}
	if (v.startsWith("area:")) {
		const id = Number(v.slice(5));
		return Number.isFinite(id) ? { kind: "area", id } : { kind: "all" };
	}
	return { kind: "all" };
}

const buildFeedUrl = (f: Filter): string => {
	const params = new URLSearchParams({ days: String(DAYS) });
	if (f.kind === "all") {
		const places = savedPlaceIds.slice(0, MAX_PLACES);
		if (savedAreaIds.length) params.set("areas", savedAreaIds.join(","));
		if (places.length) params.set("places", places.join(","));
	} else if (f.kind === "place") {
		params.set("places", String(f.id));
	} else {
		params.set("areas", String(f.id));
	}
	return `${API_BASE}/v4/activity?${params}`;
};

const fetchFeed = async () => {
	feedLoading = true;
	feedError = false;
	const gen = ++fetchGeneration;
	try {
		const res = await api.get<ActivityItem[]>(buildFeedUrl(filter));
		if (gen !== fetchGeneration) return;
		feedItems = res.data;
		page = 0;
	} catch (e) {
		if (gen !== fetchGeneration) return;
		console.error("Failed to load activity", e);
		feedError = true;
	}
	feedLoading = false;
};

const goToPage = (next: number) => {
	page = Math.max(0, Math.min(totalPages - 1, next));
};

const handleFilterChange = () => {
	feedItems = [];
	page = 0;
	feedError = false;
	fetchFeed();
};

onMount(async () => {
	session.init();
	if (!$session) {
		goto("/login");
		return;
	}

	savedPlaceIds = $session.savedPlaces ?? [];
	savedAreaIds = $session.savedAreas ?? [];
	hasSavedItems = savedPlaceIds.length > 0 || savedAreaIds.length > 0;
	initialLoading = false;

	if (!hasSavedItems) return;

	// Kick off the feed fetch immediately using the session IDs so the
	// user doesn't wait on the saved-lists round-trip.
	const feedPromise = fetchFeed();

	// Hydrate names for the filter select in parallel. Best-effort:
	// if either call fails, the select falls back to "Place <id>" /
	// "Area <id>" labels and the feed is unaffected.
	const headers = { Authorization: `Bearer ${$session.token}` };
	const [placesRes, areasRes] = await Promise.allSettled([
		api.get<SavedPlace[]>("/api/session/saved-places", { headers }),
		api.get<SavedArea[]>("/api/session/saved-areas", { headers }),
	]);
	if (placesRes.status === "fulfilled") {
		placeNames = new Map(placesRes.value.data.map((p) => [p.id, p.name]));
	}
	if (areasRes.status === "fulfilled") {
		areaNames = new Map(areasRes.value.data.map((a) => [a.id, a.name]));
	}

	await feedPromise;
});
</script>

<svelte:head>
	<title>{$_("userActivity.title")} | BTC Map</title>
</svelte:head>

<div class="mx-auto my-10 max-w-3xl px-4 md:my-20">
	<h1 class="mb-8 text-center text-4xl font-semibold text-primary dark:text-white">
		{$_("userActivity.title")}
	</h1>

	{#if initialLoading}
		<div class="flex justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-link border-t-transparent" />
		</div>
	{:else if !hasSavedItems}
		<p class="text-center text-lg text-body dark:text-white/70">
			{$_("userActivity.empty")}
		</p>
	{:else}
		<div class="mb-2">
			<FormSelect
				ariaLabel={$_("userActivity.filterLabel")}
				bind:value={filterValue}
				disabled={feedLoading}
				options={filterOptions}
				on:change={handleFilterChange}
			/>
		</div>

		<p class="mb-4 text-center text-sm text-body/70 dark:text-white/50">
			{$_("userActivity.timeWindow", { values: { days: DAYS } })}
		</p>

		<div class="mb-6 flex flex-wrap items-center justify-center gap-2">
			{#each ACTIVITY_TYPES as type (type)}
				{@const active = activeTypes.has(type)}
				<button
					type="button"
					aria-pressed={active}
					on:click={() => toggleType(type)}
					class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors {active
						? 'border-link bg-link/10 text-primary dark:border-link dark:text-white'
						: 'border-gray-300 text-body/60 hover:border-link hover:text-body dark:border-white/20 dark:text-white/50 dark:hover:text-white'}"
				>
					<span class="h-2 w-2 rounded-full {dotColor(type)}" />
					<span>{$_(TYPE_LABEL_KEYS[type])}</span>
					{#if showChipCounts}
						<span class="text-xs opacity-70">({typeCounts[type]})</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if feedLoading && !feedItems.length}
			<div class="flex justify-center">
				<div class="h-8 w-8 animate-spin rounded-full border-4 border-link border-t-transparent" />
			</div>
		{:else if feedError && !feedItems.length}
			<p class="text-center text-body dark:text-white/70">
				{$_("areaActivity.loadError")}
				<button
					class="ml-2 text-link transition-colors hover:text-hover"
					on:click={fetchFeed}
				>
					{$_("areaActivity.retry")}
				</button>
			</p>
		{:else if !feedItems.length}
			<p class="text-center text-body dark:text-white/70">{$_("areaActivity.noActivity")}</p>
		{:else if !activeTypes.size}
			<p class="text-center text-body dark:text-white/70">
				{$_("userActivity.noTypesSelected")}
			</p>
		{:else if !visibleItems.length}
			<p class="text-center text-body dark:text-white/70">{$_("areaActivity.noActivity")}</p>
		{:else}
			{#if totalPages > 1}
				<div class="mb-4 flex items-center justify-center gap-4">
					<button
						type="button"
						aria-label={$_("aria.previousPage")}
						class="rounded-full p-2 text-link transition-colors enabled:hover:bg-gray-100 disabled:opacity-40 dark:enabled:hover:bg-white/10"
						disabled={page === 0}
						on:click={() => goToPage(page - 1)}
					>
						<Icon type="material" icon="chevron_left" w="24" h="24" />
					</button>
					<span class="text-sm text-body dark:text-white/70">
						{page + 1} / {totalPages}
					</span>
					<button
						type="button"
						aria-label={$_("aria.nextPage")}
						class="rounded-full p-2 text-link transition-colors enabled:hover:bg-gray-100 disabled:opacity-40 dark:enabled:hover:bg-white/10"
						disabled={page >= totalPages - 1}
						on:click={() => goToPage(page + 1)}
					>
						<Icon type="material" icon="chevron_right" w="24" h="24" />
					</button>
				</div>
			{/if}

			<div class="rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
				<div class="space-y-2 p-2">
					{#each pagedItems as item, i (item.type + "-" + item.place_id + "-" + item.date + "-" + i)}
						<div
							class="flex flex-col items-center gap-2 p-5 text-center text-xl lg:flex-row lg:gap-5 lg:text-left"
						>
							<span class="relative mx-auto mb-2 flex h-3 w-3 lg:mx-0 lg:mb-0">
								<span
									class="{i === 0 ? 'animate-ping' : ''} absolute inline-flex h-full w-full rounded-full {dotColor(
										item.type,
									)} opacity-75"
								/>
								<span
									class="relative inline-flex h-3 w-3 rounded-full {dotColor(item.type)}"
								/>
							</span>

							<div
								class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0"
							>
								<div class="space-y-2 lg:space-y-0">
									<span class="text-primary lg:mr-5 dark:text-white">
										{#if item.type === "place_added" || item.type === "place_updated" || item.type === "place_deleted"}
											<a
												href={resolve(`/merchant/${item.place_id}`)}
												class="break-all text-link transition-colors hover:text-hover"
											>
												{item.place_name || item.place_id}
											</a>
											{$_("areaActivity.was")}
											<strong
												>{item.type === "place_added"
													? $_("areaActivity.created")
													: item.type === "place_deleted"
														? $_("areaActivity.deleted")
														: $_("areaActivity.updated")}</strong
											>
											{#if item.osm_user_id && item.osm_user_name}
												{$_("areaActivity.by")}
												<a
													href={resolve(`/tagger/${item.osm_user_id}`)}
													class="break-all text-link transition-colors hover:text-hover"
												>
													{item.osm_user_name}
												</a>
											{/if}
										{:else if item.type === "place_commented"}
											<Icon
												type="fa"
												icon="comment"
												w="16"
												h="16"
												class="mr-1 inline align-middle"
											/>
											<a
												href={resolve(`/merchant/${item.place_id}`)}
												class="break-all text-link transition-colors hover:text-hover"
											>
												{item.place_name || item.place_id}
											</a>
											{$_("areaActivity.commented")}
											<span class="italic"
												>"{item.comment && item.comment.length > 80
													? item.comment.slice(0, 77) + "..."
													: item.comment}"</span
											>
										{:else if item.type === "place_boosted"}
											<Icon
												type="fa"
												icon="bolt"
												w="16"
												h="16"
												class="mr-1 inline align-middle text-orange-500"
											/>
											<a
												href={resolve(`/merchant/${item.place_id}`)}
												class="break-all text-link transition-colors hover:text-hover"
											>
												{item.place_name || item.place_id}
											</a>
											{$_("areaActivity.was")}
											<strong>{$_("areaActivity.boosted")}</strong>
											{#if item.duration_days != null}
												{$_("areaActivity.forDays", { values: { days: item.duration_days } })}
											{/if}
										{/if}
									</span>

									<span
										class="block text-center font-semibold text-taggerTime lg:inline dark:text-white/70"
									>
										<Time live={3000} relative timestamp={item.date} />
									</span>
								</div>
							</div>
						</div>
					{/each}

				</div>
			</div>

			{#if totalPages > 1}
				<div class="mt-4 flex items-center justify-center gap-4">
					<button
						type="button"
						aria-label={$_("aria.previousPage")}
						class="rounded-full p-2 text-link transition-colors enabled:hover:bg-gray-100 disabled:opacity-40 dark:enabled:hover:bg-white/10"
						disabled={page === 0}
						on:click={() => goToPage(page - 1)}
					>
						<Icon type="material" icon="chevron_left" w="24" h="24" />
					</button>
					<span class="text-sm text-body dark:text-white/70">
						{page + 1} / {totalPages}
					</span>
					<button
						type="button"
						aria-label={$_("aria.nextPage")}
						class="rounded-full p-2 text-link transition-colors enabled:hover:bg-gray-100 disabled:opacity-40 dark:enabled:hover:bg-white/10"
						disabled={page >= totalPages - 1}
						on:click={() => goToPage(page + 1)}
					>
						<Icon type="material" icon="chevron_right" w="24" h="24" />
					</button>
				</div>
			{/if}
		{/if}
	{/if}
</div>
