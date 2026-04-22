<script lang="ts">
import Time from "svelte-time";

import Icon from "$components/Icon.svelte";
import { type ActivityItem, dotColor } from "$lib/activity";
import { _ } from "$lib/i18n";

import { resolve } from "$app/paths";

export let item: ActivityItem;
// When true, the outer ping-dot animates. Intended for the newest
// (top-of-list) card so the feed has a single pulse of visual motion.
export let highlight = false;
</script>

<div
	class="flex flex-col items-center gap-2 p-5 text-center text-xl lg:flex-row lg:gap-5 lg:text-left"
>
	<span class="relative mx-auto mb-2 flex h-3 w-3 lg:mx-0 lg:mb-0">
		<span
			class="{highlight
				? 'animate-ping'
				: ''} absolute inline-flex h-full w-full rounded-full {dotColor(item.type)} opacity-75"
		/>
		<span class="relative inline-flex h-3 w-3 rounded-full {dotColor(item.type)}" />
	</span>

	<div class="w-full flex-wrap items-center justify-between space-y-2 lg:flex lg:space-y-0">
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
					<Icon type="fa" icon="comment" w="16" h="16" class="mr-1 inline align-middle" />
					<a
						href={resolve(`/merchant/${item.place_id}`)}
						class="break-all text-link transition-colors hover:text-hover"
					>
						{item.place_name || item.place_id}
					</a>
					{#if item.comment}
						{$_("areaActivity.commented")}
						<span class="italic"
							>"{item.comment.length > 80
								? item.comment.slice(0, 77) + "..."
								: item.comment}"</span
						>
					{/if}
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

			<span class="block text-center font-semibold text-taggerTime lg:inline dark:text-white/70">
				<Time live={3000} relative timestamp={item.date} />
			</span>
		</div>
	</div>
</div>
