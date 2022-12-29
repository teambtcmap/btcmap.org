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

	const stats = [
		{ stat: upToDate, title: 'Up-To-Date' },
		{ stat: total, title: 'Total Locations' },
		{ stat: legacy, title: 'Legacy Locations' },
		{ stat: grade, title: 'Grade' }
	];
</script>

<div
	class="py-5 border-b border-statBorder text-center text-link lg:grid grid-cols-6 text-lg font-semibold"
>
	<span class="my-auto underline lg:no-underline underline-offset-4 decoration-4">{position}</span>

	<div class="my-5 lg:my-0">
		<img
			src={avatar}
			alt="avatar"
			class="rounded-full w-20 h-20 lg:w-14 lg:h-14 object-cover mx-auto mb-2"
		/>

		<a
			href="/community/{id}"
			class="hover:text-hover {name.match('([^ ]{21})') ? 'break-all' : ''} transition-colors"
			>{name}</a
		>

		{#if sponsor}
			<SponsorBadge />
		{/if}
	</div>

	{#each stats as stat}
		<span class="flex lg:inline-flex justify-center items-center my-2 lg:my-0">
			<span class="text-primary lg:hidden mr-1">{stat.title}:</span>
			{stat.stat}
			{#if stat.title === 'Up-To-Date'}
				%
			{:else if stat.title === 'Grade'}
				<i class="fa-solid fa-star ml-1" />
			{/if}
		</span>
	{/each}
</div>
