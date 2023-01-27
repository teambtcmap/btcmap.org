<script>
	export let position;
	export let avatar;
	export let name;
	export let sponsor;
	export let id;
	export let upToDate;
	export let total;
	export let legacy;
	export let grade;

	import { SponsorBadge } from '$comp';

	$: stats = [
		{ stat: upToDate, title: 'Up-To-Date' },
		{ stat: total, title: 'Total Locations' },
		{ stat: legacy, title: 'Legacy' },
		{ stat: grade, title: 'Grade' }
	];
</script>

<div
	class="py-5 border-b border-statBorder text-center text-link lg:grid grid-cols-6 text-lg font-semibold"
>
	<span
		class="my-auto {position > 3
			? 'underline'
			: ''} lg:no-underline underline-offset-4 decoration-4"
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
			src={avatar}
			alt="avatar"
			class="rounded-full w-20 h-20 lg:w-14 lg:h-14 object-cover mx-auto mb-2"
			onerror="this.src='/images/communities/bitcoin.svg'"
		/>

		<a
			href="/community/{id}"
			class="hover:text-hover {name.match('([^ ]{21})')
				? 'break-all'
				: ''} transition-colors inline-block mb-1">{name}</a
		>

		{#if sponsor}
			<SponsorBadge />
		{/if}
	</div>

	{#each stats as stat}
		<span class="flex lg:inline-flex justify-center items-center my-2 lg:my-0">
			<span class="text-primary lg:hidden mr-1">{stat.title}:</span>
			{#if stat.title === 'Up-To-Date'}
				<div class="w-[100px] bg-link/25">
					<div
						class="bg-link text-xs font-semibold text-white text-center p-1 leading-none"
						style="width: {stat.stat}%"
					>
						{stat.stat}%
					</div>
				</div>
			{:else if stat.title === 'Grade'}
				<div class="space-x-1">
					{#each Array(stat.stat) as star}
						<i class="fa-solid fa-star" />
					{/each}

					{#each Array(5 - stat.stat) as star}
						<i class="fa-solid fa-star opacity-25" />
					{/each}
				</div>
			{:else}
				{stat.stat}
			{/if}
		</span>
	{/each}
</div>
