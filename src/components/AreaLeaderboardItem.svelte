<script lang="ts">
	export let type: AreaType;
	export let position: number;
	export let avatar: string;
	export let name: string;
	export let sponsor: boolean;
	export let id: string;
	export let upToDate: number;
	export let total: number;
	export let grade: Grade;

	import { SponsorBadge } from '$lib/comp';
	import type { AreaType, Grade } from '$lib/types';

	$: stats = [
		{ stat: upToDate, title: 'Up-To-Date' },
		{ stat: total, title: 'Total Locations' },
		{ stat: grade, title: 'Grade' }
	];
</script>

<div
	class="grid-cols-5 border-b border-statBorder py-5 text-center text-lg font-semibold text-link lg:grid"
>
	<span
		class="my-auto {position > 3
			? 'underline'
			: ''} decoration-4 underline-offset-4 lg:no-underline"
	>
		{#if position === 1}
			<span class="text-2xl">🥇</span>
		{:else if position === 2}
			<span class="text-2xl">🥈</span>
		{:else if position === 3}
			<span class="text-2xl">🥉</span>
		{:else}
			{position}
		{/if}
	</span>

	<div class="my-5 lg:my-0">
		<img
			src={type === 'community'
				? `https://btcmap.org/.netlify/images?url=${avatar}&fit=cover&w=256&h=256`
				: avatar}
			alt="avatar"
			class="mx-auto mb-2 h-20 w-20 rounded-full object-cover lg:h-14 lg:w-14"
			on:error={function () {
				this.src = '/images/bitcoin.svg';
			}}
		/>

		<a
			href="/{type}/{id}"
			class="hover:text-hover {name.match('([^ ]{21})')
				? 'break-all'
				: ''} mb-1 inline-block transition-colors">{name}</a
		>

		{#if sponsor}
			<SponsorBadge />
		{/if}
	</div>

	{#each stats as stat (stat.title)}
		<span class="my-2 flex items-center justify-center lg:my-0 lg:inline-flex">
			<span class="mr-1 text-primary dark:text-white lg:hidden">{stat.title}:</span>
			{#if stat.title === 'Up-To-Date'}
				<div class="w-[100px] bg-link/25">
					<div
						class="bg-link p-1 text-center text-xs font-semibold leading-none text-white"
						style="width: {stat.stat}%"
					>
						{stat.stat}%
					</div>
				</div>
			{:else if stat.title === 'Grade'}
				<div class="space-x-1">
					{#each Array(stat.stat) as _, index (index)}
						<i class="fa-solid fa-star" />
					{/each}

					{#each Array(5 - stat.stat) as _, index (index)}
						<i class="fa-solid fa-star opacity-25" />
					{/each}
				</div>
			{:else}
				{stat.stat}
			{/if}
		</span>
	{/each}
</div>
