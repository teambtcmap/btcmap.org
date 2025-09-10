<script lang="ts">
	import type { ActivityEvent } from '$lib/types';
	import { format } from 'date-fns';
	import { createEventDispatcher } from 'svelte';
	import { resolve } from '$app/paths';

	export let eventElements: ActivityEvent[] = [];
	export let username: string;
	export let dataInitialized: boolean = false;
	export let loadingNames: boolean = false;

	const dispatch = createEventDispatcher<{
		fetchNames: { events: ActivityEvent[] };
	}>();

	let currentPage = 1;
	let itemsPerPage = 10;

	$: totalPages = Math.ceil(eventElements.length / itemsPerPage);
	$: paginatedEvents = eventElements.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);

	// Fetch place names for current page
	const fetchPageNames = async (events: ActivityEvent[]) => {
		if (loadingNames) return;

		dispatch('fetchNames', { events });
	};

	$: if (paginatedEvents.length > 0 && dataInitialized) {
		fetchPageNames(paginatedEvents);
	}
</script>

<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
	<h3
		class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
	>
		{username || 'BTC Map Supertagger'}'s Activity
	</h3>

	{#if eventElements && eventElements.length && dataInitialized}
		<div class="overflow-x-auto">
			<table class="w-full">
				<thead>
					<tr class="border-b border-statBorder text-left">
						<th class="w-2/3 px-5 py-3 text-left text-sm font-semibold text-primary dark:text-white"
							>Location</th
						>
						<th class="w-1/6 px-5 py-3 text-left text-sm font-semibold text-primary dark:text-white"
							>Action</th
						>
						<th class="w-1/6 px-5 py-3 text-left text-sm font-semibold text-primary dark:text-white"
							>Date</th
						>
					</tr>
				</thead>
				<tbody>
					{#if loadingNames}
						<!-- Show loading skeleton rows while fetching names -->
						{#each Array(itemsPerPage) as _, i (i)}
							<tr class="border-b border-statBorder/50">
								<td class="w-2/3 px-5 py-3">
									<div class="h-6 animate-pulse rounded bg-link/20"></div>
								</td>
								<td class="w-1/6 px-5 py-3">
									<div class="h-6 animate-pulse rounded bg-link/20"></div>
								</td>
								<td class="w-1/6 px-5 py-3">
									<div class="h-6 animate-pulse rounded bg-link/20"></div>
								</td>
							</tr>
						{/each}
					{:else}
						{#each paginatedEvents as event, _ (event['created_at'])}
							<tr class="border-b border-statBorder/50 hover:bg-gray-50 dark:hover:bg-white/5">
								<td class="w-2/3 px-5 py-3 text-left">
									<a
										href={resolve('/merchant/{event.merchantId}')}
										class="text-link transition-colors hover:text-hover"
									>
										{event.location}
									</a>
								</td>
								<td class="w-1/6 px-5 py-3 text-left">
									<span
										class="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
										{event.type === 'create'
											? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
											: event.type === 'update'
												? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
												: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}"
									>
										{event.type}
									</span>
								</td>
								<td class="w-1/6 px-5 py-3 text-left text-sm text-body dark:text-white">
									{format(new Date(event['created_at']), 'MMM d, yyyy HH:mm')}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between border-t border-statBorder px-5 py-3">
				<div class="text-sm text-body dark:text-white">
					Page {currentPage} of {totalPages} ({eventElements.length} total)
				</div>
				<div class="flex space-x-2">
					<button
						on:click={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage === 1}
						class="rounded border border-statBorder px-3 py-1 text-sm
						       text-primary transition-colors
						       hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50
						       dark:text-white dark:hover:bg-white/5"
					>
						Previous
					</button>
					<button
						on:click={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage === totalPages}
						class="rounded border border-statBorder px-3 py-1 text-sm
						       text-primary transition-colors
						       hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50
						       dark:text-white dark:hover:bg-white/5"
					>
						Next
					</button>
				</div>
			</div>
		{/if}
	{:else}
		<div class="p-5">
			{#each Array(10) as _, i (i)}
				<div class="mb-3 animate-pulse">
					<div class="flex space-x-4">
						<div class="h-4 w-2/3 rounded bg-link/20"></div>
						<div class="h-4 w-1/6 rounded bg-link/20"></div>
						<div class="h-4 w-1/6 rounded bg-link/20"></div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
