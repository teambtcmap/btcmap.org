<script lang="ts">
	import type { Table } from '@tanstack/svelte-table';
	import type { TaggerLeaderboard } from '$lib/types';
	import { resolve } from '$app/paths';
	import Tip from '$components/Tip.svelte';

	type TaggerRow = TaggerLeaderboard & {
		position: number;
		tipDestination?: string;
	};

	export let table: Table<TaggerRow>;
</script>

<div class="space-y-1 lg:hidden">
	{#each table.getRowModel().rows as row (row.id)}
		{@const tagger = row.original}
		<div class="space-y-4 border-b border-gray-300 p-4 dark:border-white/20">
			<div class="flex items-center gap-3">
				<div class="text-2xl">
					{#if tagger.position === 1}🥇
					{:else if tagger.position === 2}🥈
					{:else if tagger.position === 3}🥉
					{:else}
						{tagger.position}
					{/if}
				</div>
				<div>
					<p class="text-body dark:text-white/70">Total</p>
					<p class="font-semibold text-primary dark:text-white">{tagger.total.toLocaleString()}</p>
				</div>
				<img
					src={tagger.avatar}
					alt={tagger.tagger}
					class="h-14 w-14 rounded-full object-cover"
					on:error={(event) => {
						const target = event.target;
						if (target instanceof HTMLImageElement) {
							target.src = '/images/satoshi-nakamoto.png';
						}
					}}
					loading="lazy"
				/>
				<div class="flex-1">
					<a
						href={resolve(`/tagger/${tagger.id}`)}
						class="text-lg font-semibold text-link transition-colors hover:text-hover"
					>
						{tagger.tagger}
					</a>
				</div>

				{#if tagger.tipDestination}
					<Tip destination={tagger.tipDestination} style="h-[34px] px-5" />
				{/if}
			</div>

			<div class="grid grid-cols-3 gap-3 text-center text-sm">
				<div>
					<p class="text-body dark:text-white/70">Created</p>
					<p class="font-semibold text-primary dark:text-white">
						{tagger.created.toLocaleString()}
					</p>
				</div>
				<div>
					<p class="text-body dark:text-white/70">Updated</p>
					<p class="font-semibold text-primary dark:text-white">
						{tagger.updated.toLocaleString()}
					</p>
				</div>
				<div>
					<p class="text-body dark:text-white/70">Deleted</p>
					<p class="font-semibold text-primary dark:text-white">
						{tagger.deleted.toLocaleString()}
					</p>
				</div>
			</div>
		</div>
	{/each}
</div>
