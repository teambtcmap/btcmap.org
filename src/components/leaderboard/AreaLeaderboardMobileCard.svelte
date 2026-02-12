<script lang="ts">
import type { Table } from "@tanstack/svelte-table";

import GradeDisplay from "$components/leaderboard/GradeDisplay.svelte";
import type { AreaType } from "$lib/types";
import { isEven } from "$lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let table: Table<any>;
export let type: AreaType;
</script>

<!-- Mobile cards -->
<div class="space-y-1">
	{#each table.getRowModel().rows as row, index (row.id)}
		{@const area = row.original}
		{@const position = area.position}
		{@const grade = area.grade || 0}
		{@const percentage = area.report?.tags?.up_to_date_percent}
		{@const avgDate = area.report?.tags?.avg_verification_date}
		{@const totalElements = area.report?.tags?.total_elements || 0}
		{@const upToDateElements = area.report?.tags?.up_to_date_elements || 0}

		<!-- Card with three-row layout -->
		<div
			class="space-y-4 p-4 {isEven(index)
				? 'bg-primary/5 dark:bg-white/5'
				: 'bg-white dark:bg-transparent'}"
			role="row"
		>
			<!-- Row 1: Larger Avatar -->
			<div class="flex justify-center">
				<img
					src={type === 'community'
						? `https://btcmap.org/.netlify/images?url=${area.tags?.['icon:square'] || ''}&fit=cover&w=256&h=256`
						: `https://static.btcmap.org/images/countries/${area.id}.svg`}
					alt="{area.tags?.name || 'Unknown'} avatar"
					class="h-16 w-16 rounded-full object-cover"
					on:error={(e) => {
						const target = e.target;
						if (target instanceof HTMLImageElement) {
							target.src = '/images/bitcoin.svg';
						}
					}}
					loading="lazy"
				/>
			</div>

			<!-- Row 2: Name (centered and prominent) -->
			<div class="text-center">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={`/${type}/${area.tags?.url_alias || area.id || ''}`}
					class="text-lg font-semibold text-link transition-colors hover:text-hover {area.tags?.name?.match(
						/[^ ]{21}/
					)
						? 'break-all'
						: ''}"
					aria-label="View {area.tags?.name || 'Unknown'} details"
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{area.tags?.name || 'Unknown'}
				</a>
			</div>

			<!-- Row 3: Stats in a 4-column grid (no headers, just data) -->
			<div class="grid grid-cols-4 gap-3 text-center text-sm">
				<!-- Position -->
				<div class="text-lg">
					{#if position === 1}🥇
					{:else if position === 2}🥈
					{:else if position === 3}🥉
					{:else}
						<span class="font-semibold text-primary dark:text-white">{position}</span>
					{/if}
				</div>

				<!-- Total Locations -->
				<div class="text-sm font-semibold text-primary dark:text-white">
					{totalElements}
				</div>

				<!-- Verified Locations -->
				<div class="text-sm font-semibold text-primary dark:text-white">
					{upToDateElements}
				</div>

				<!-- Grade -->
				<div class="text-sm">
					<GradeDisplay {grade} {percentage} {avgDate} size="small" />
				</div>
			</div>
		</div>
	{/each}
</div>
