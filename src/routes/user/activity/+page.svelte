<script lang="ts">
import { onMount } from "svelte";
import Time from "svelte-time";

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

const DOT_COLORS: Record<ActivityType, string> = {
	place_commented: "bg-amber-500",
	place_boosted: "bg-orange-500",
	place_added: "bg-created",
	place_deleted: "bg-deleted",
	place_updated: "bg-link",
};

const dotColor = (type: ActivityType) => DOT_COLORS[type];

let savedPlaces: SavedPlace[] = [];
let savedAreas: SavedArea[] = [];
let hasSavedItems = false;
let filter: Filter = { kind: "all" };
let feedItems: ActivityItem[] = [];
let page = 0;
let initialLoading = true;
let feedLoading = false;
let feedError = false;
let fetchGeneration = 0;

$: pagedItems = feedItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
$: totalPages = Math.max(1, Math.ceil(feedItems.length / PAGE_SIZE));

const buildFeedUrl = (f: Filter): string => {
	const params = new URLSearchParams({ days: String(DAYS) });
	if (f.kind === "all") {
		if (savedAreas.length)
			params.set("areas", savedAreas.map((a) => a.id).join(","));
		if (savedPlaces.length)
			params.set("places", savedPlaces.map((p) => p.id).join(","));
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

const handleFilterChange = (e: Event) => {
	const value = (e.target as HTMLSelectElement).value;
	if (value === "all") {
		filter = { kind: "all" };
	} else if (value.startsWith("place:")) {
		filter = { kind: "place", id: Number(value.slice(6)) };
	} else if (value.startsWith("area:")) {
		filter = { kind: "area", id: Number(value.slice(5)) };
	}
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

	const headers = { Authorization: `Bearer ${$session.token}` };
	const [placesRes, areasRes] = await Promise.allSettled([
		api.get<SavedPlace[]>("/api/session/saved-places", { headers }),
		api.get<SavedArea[]>("/api/session/saved-areas", { headers }),
	]);
	if (placesRes.status === "fulfilled") savedPlaces = placesRes.value.data;
	if (areasRes.status === "fulfilled") savedAreas = areasRes.value.data;

	hasSavedItems = savedPlaces.length > 0 || savedAreas.length > 0;
	initialLoading = false;

	if (hasSavedItems) {
		await fetchFeed();
	}
});
</script>

<svelte:head>
	<title>My activity | BTC Map</title>
</svelte:head>

<div class="mx-auto my-10 max-w-3xl px-4 md:my-20">
	<h1 class="mb-8 text-center text-4xl font-semibold text-primary dark:text-white">My activity</h1>

	{#if initialLoading}
		<div class="flex justify-center">
			<div class="h-8 w-8 animate-spin rounded-full border-4 border-link border-t-transparent" />
		</div>
	{:else if !hasSavedItems}
		<p class="text-center text-lg text-body dark:text-white/70">
			You haven't saved any places or areas yet. Save some from the map and come back here to see
			activity on them.
		</p>
	{:else}
		<div class="mb-2 flex justify-center">
			<select
				class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-body dark:border-white/20 dark:bg-white/10 dark:text-white"
				on:change={handleFilterChange}
			>
				<option value="all">All saved items</option>
				{#if savedPlaces.length}
					<optgroup label="Places">
						{#each savedPlaces as place (place.id)}
							<option value={`place:${place.id}`}>{place.name || `Place ${place.id}`}</option>
						{/each}
					</optgroup>
				{/if}
				{#if savedAreas.length}
					<optgroup label="Areas">
						{#each savedAreas as area (area.id)}
							<option value={`area:${area.id}`}>{area.name || `Area ${area.id}`}</option>
						{/each}
					</optgroup>
				{/if}
			</select>
		</div>

		<p class="mb-6 text-center text-sm text-body/70 dark:text-white/50">
			Showing activity from the last {DAYS} days
		</p>

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
											{$_("areaActivity.forDays", { values: { days: item.duration_days } })}
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
