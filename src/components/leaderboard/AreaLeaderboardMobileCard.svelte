<script lang="ts">
import type { Table } from "@tanstack/svelte-table";

import GradeDisplay from "$components/leaderboard/GradeDisplay.svelte";
import LeaderboardCountryName from "$components/leaderboard/LeaderboardCountryName.svelte";
import { _ } from "$lib/i18n";
import type { AreaType } from "$lib/types";
import { areaIconSrc, isEven } from "$lib/utils";

export let table: Table<any>;
export let type: AreaType;
</script>

<!-- Mobile cards -->
<div class="space-y-1">
	{#each table.getRowModel().rows as row, index (row.id)}
		{@const area = row.original}
		{@const position = area.position}
		{@const grade = area.grade || 0}
		{@const percentage = area.places_total > 0
			? Math.round((area.places_verified_1y / area.places_total) * 100)
			: 0}
		{@const totalElements = area.places_total || 0}
		{@const upToDateElements = area.places_verified_1y || 0}

		<!-- Card with three-row layout -->
		<div
			class="space-y-4 p-4 {isEven(index)
				? 'bg-primary/5 dark:bg-white/5'
				: 'bg-white dark:bg-transparent'}"
			role="row"
		>
			{#if type === 'country'}
				<LeaderboardCountryName
					countryCode={area.alias}
					name={area.name || 'Unknown'}
					let:localizedName
				>
					<!-- Row 1: Larger Avatar -->
					<div class="flex justify-center">
						<img
							src={area.icon || `https://static.btcmap.org/images/countries/${area.alias}.svg`}
							alt="{localizedName} avatar"
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
						<a
							href={`/${type}/${encodeURIComponent(area.alias || String(area.id) || '')}`}
							class="text-lg font-semibold text-link transition-colors hover:text-hover {localizedName?.match(
								/[^ ]{21}/
							)
								? 'break-all'
								: ''}"
							aria-label={$_('areaLeaderboard.viewDetails', { values: { name: localizedName } })}
						>
							{localizedName}
						</a>
					</div>
				</LeaderboardCountryName>
			{:else}
				<!-- Row 1: Larger Avatar -->
				<div class="flex justify-center">
					<img
						src={areaIconSrc(area.icon)}
						alt="{area.name || 'Unknown'} avatar"
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
					<a
						href={`/${type}/${encodeURIComponent(area.alias || String(area.id) || '')}`}
						class="text-lg font-semibold text-link transition-colors hover:text-hover {area.name?.match(
							/[^ ]{21}/
						)
							? 'break-all'
							: ''}"
						aria-label={$_('areaLeaderboard.viewDetails', { values: { name: area.name || 'Unknown' } })}
					>
						{area.name || 'Unknown'}
					</a>
				</div>
			{/if}

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
					<GradeDisplay {grade} {percentage} size="small" />
				</div>
			</div>
		</div>
	{/each}
</div>
