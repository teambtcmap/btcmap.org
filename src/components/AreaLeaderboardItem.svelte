<script lang="ts">

	import { SponsorBadge } from '$lib/comp';
	import type { AreaType, Grade } from '$lib/types';
	interface Props {
		type: AreaType;
		position: number;
		avatar: string;
		name: string;
		sponsor: boolean;
		id: string;
		upToDate: number;
		total: number;
		grade: Grade;
	}

	let {
		type,
		position,
		avatar,
		name,
		sponsor,
		id,
		upToDate,
		total,
		grade
	}: Props = $props();

	let stats = $derived([
		{ stat: upToDate, title: 'Up-To-Date' },
		{ stat: total, title: 'Total Locations' },
		{ stat: grade, title: 'Grade' }
	]);
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
			onerror={function () {
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

	{#each stats as stat}
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
					<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
					{#each Array(stat.stat) as star}
						<i class="fa-solid fa-star"></i>
					{/each}

					<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
					{#each Array(5 - stat.stat) as star}
						<i class="fa-solid fa-star opacity-25"></i>
					{/each}
				</div>
			{:else}
				{stat.stat}
			{/if}
		</span>
	{/each}
</div>
