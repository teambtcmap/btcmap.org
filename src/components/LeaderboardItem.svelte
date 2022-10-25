<script>
	export let position;
	export let avatar;
	export let tagger;
	export let id;
	export let created;
	export let updated;
	export let deleted;
	export let tip;

	import { Tip } from '$comp';

	$: stats = [
		{ stat: created, title: 'C' },
		{ stat: updated, title: 'U' },
		{ stat: deleted, title: 'D' }
	];

	$: regexMatch = tip && tip.match('(lightning:[^)]+)');
	$: lightning = regexMatch && regexMatch[0].slice(10);
</script>

<div
	class="py-5 lg:py-0 border-t border-b border-statBorder lg:border-none space-y-5 lg:space-y-0 text-center lg:grid grid-cols-6 text-lg font-semibold"
>
	<span class="text-link my-auto underline lg:no-underline underline-offset-4 decoration-4"
		>{position}</span
	>

	<div class="lg:flex lg:space-x-2 items-center">
		<img
			src={avatar}
			alt="avatar"
			class="rounded-full w-20 h-20 lg:w-14 lg:h-14 object-cover mx-auto lg:mx-0 mb-2 lg:mb-0"
		/>

		<a
			href="/tagger/{id}"
			class="lg:text-left text-link hover:text-hover {tagger.match('([^ ]{12})')
				? 'break-all'
				: ''}">{tagger}</a
		>
	</div>

	{#each stats as stat}
		<span class="text-link lg:!my-auto mx-5 lg:mx-0 inline-block">
			<span
				class="h-3 w-3 inline-block rounded-full mr-1 {stat.title === 'C'
					? 'bg-created'
					: stat.title === 'U'
					? 'bg-link'
					: 'bg-deleted'} lg:hidden"
			/>{stat.stat}
		</span>
	{/each}

	{#if lightning}
		<Tip destination={lightning} style="mx-auto lg:!my-auto lg:h-[30px] block lg:inline" />
	{/if}
</div>
