<script lang="ts">
	import type { Table } from '@tanstack/svelte-table';
	import type { TaggerLeaderboard } from '$lib/types';
	import { resolve } from '$app/paths';
	import { isEven } from '$lib/utils';
	import Icon from '$components/Icon.svelte';

	type TaggerRow = TaggerLeaderboard & {
		position: number;
		tipDestination?: string;
	};

	export let table: Table<TaggerRow>;
</script>

<!-- Mobile cards -->
<div class="space-y-1 lg:hidden">
	{#each table.getRowModel().rows as row (row.id)}
		{@const tagger = row.original}

		<!-- Card with three-row layout -->
		<div
			class="space-y-4 p-4 {isEven(tagger.position - 1)
				? 'bg-primary/5 dark:bg-white/5'
				: 'bg-white dark:bg-transparent'}"
			role="row"
		>
			<!-- Row 1: Position, Avatar, Name -->
			<div class="flex items-center gap-3">
				<!-- Position -->
				<div class="text-2xl">
					{#if tagger.position === 1}🥇
					{:else if tagger.position === 2}🥈
					{:else if tagger.position === 3}🥉
					{:else}
						<span class="font-semibold text-primary dark:text-white">{tagger.position}</span>
					{/if}
				</div>

				<!-- Avatar -->
				<img
					src={tagger.avatar}
					alt={tagger.tagger}
					class="h-16 w-16 rounded-full object-cover"
					on:error={(event) => {
						const target = event.target;
						if (target instanceof HTMLImageElement) {
							target.src = '/images/satoshi-nakamoto.png';
						}
					}}
					loading="lazy"
				/>

				<!-- Name (flex-1 to take remaining space) -->
				<div class="min-w-0 flex-1">
					<a
						href={resolve(`/tagger/${tagger.id}`)}
						class="truncate text-lg font-semibold text-link transition-colors hover:text-hover"
					>
						{tagger.tagger}
					</a>
				</div>

				<!-- Tip button -->
				{#if tagger.tipDestination}
					<div class="ml-auto">
						<a
							href={`lightning:${tagger.tipDestination}`}
							target="_blank"
							rel="noreferrer"
							class="text-primary transition-colors hover:text-hover dark:text-white"
						>
							<Icon type="fa" icon="bolt" w="16" h="16" />
						</a>
					</div>
				{/if}
			</div>

			<!-- Row 2: Stats in a 3-column grid (no headers, just data) -->
			<div class="grid grid-cols-3 gap-3 text-center text-sm">
				<!-- Total Edits -->
				<div>
					<p class="text-body dark:text-white/70">Total</p>
					<p class="font-semibold text-primary dark:text-white">{tagger.total.toLocaleString()}</p>
				</div>

				<!-- Created -->
				<div>
					<p class="text-body dark:text-white/70">Created</p>
					<p class="font-semibold text-primary dark:text-white">
						{tagger.created.toLocaleString()}
					</p>
				</div>

				<!-- Updated -->
				<div>
					<p class="text-body dark:text-white/70">Updated</p>
					<p class="font-semibold text-primary dark:text-white">
						{tagger.updated.toLocaleString()}
					</p>
				</div>
			</div>
		</div>
	{/each}
</div>
