<script>
	export let position;
	export let avatar;
	export let name;
	export let org;
	export let sponsor;
	export let id;
	export let upToDate;
	export let total;
	export let legacy;
	export let grade;

	import { SponsorBadge, OrgBadge } from '$comp';

	$: stats = [
		{ stat: upToDate, title: 'Up-To-Date' },
		{ stat: total, title: 'Total Locations' },
		{ stat: legacy, title: 'Legacy' },
		{ stat: grade, title: 'Grade' }
	];
</script>

<div
	class="grid-cols-6 border-b border-statBorder py-5 text-center text-lg font-semibold text-link lg:grid"
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
			src={avatar}
			alt="avatar"
			class="mx-auto mb-2 h-20 w-20 rounded-full object-cover lg:h-14 lg:w-14"
			onerror="this.src='/images/communities/bitcoin.svg'"
		/>

		<a
			href="/community/{id}"
			class="hover:text-hover {name.match('([^ ]{21})')
				? 'break-all'
				: ''} mb-1 inline-block transition-colors">{name}</a
		>

		<div class="space-y-2">
			{#if org}
				<OrgBadge {org} />
			{/if}

			{#if sponsor}
				<SponsorBadge />
			{/if}
		</div>
	</div>

	{#each stats as stat}
		<span class="my-2 flex items-center justify-center lg:my-0 lg:inline-flex">
			<span class="mr-1 text-primary lg:hidden">{stat.title}:</span>
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
