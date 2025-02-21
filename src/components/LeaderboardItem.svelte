<script lang="ts">

	import { Tip } from '$lib/comp';
	interface Props {
		position: number;
		avatar: string;
		tagger: string;
		id: number;
		created: number;
		updated: number;
		deleted: number;
		tip: string;
	}

	let {
		position,
		avatar,
		tagger,
		id,
		created,
		updated,
		deleted,
		tip
	}: Props = $props();

	let stats = $derived([
		{ stat: created, title: 'C' },
		{ stat: updated, title: 'U' },
		{ stat: deleted, title: 'D' }
	]);

	let regexMatch = $derived(tip && tip.match('(lightning:[^)]+)'));
	let lightning = $derived(regexMatch && regexMatch[0].slice(10));
</script>

<div
	class="grid-cols-6 space-y-5 border-b border-t border-statBorder py-5 text-center text-lg font-semibold lg:grid lg:space-y-0 lg:border-none lg:py-0"
>
	<span
		class="my-auto text-link {position > 3
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

	<div class="items-center lg:flex lg:space-x-2">
		<img
			src={avatar}
			alt="avatar"
			class="mx-auto mb-2 h-20 w-20 rounded-full object-cover lg:mx-0 lg:mb-0 lg:h-14 lg:w-14"
			onerror={function () {
				this.src = '/images/satoshi-nakamoto.png';
			}}
		/>

		<a
			href="/tagger/{id}"
			class="text-link hover:text-hover lg:text-left {tagger.match('([^ ]{16})')
				? 'break-all'
				: ''} transition-colors">{tagger}</a
		>
	</div>

	{#each stats as stat}
		<span class="mx-5 inline-block text-link lg:!my-auto lg:mx-0">
			<span
				class="mr-1 inline-block h-3 w-3 rounded-full {stat.title === 'C'
					? 'bg-created'
					: stat.title === 'U'
						? 'bg-link'
						: 'bg-deleted'} lg:hidden"
			></span>{stat.stat}
		</span>
	{/each}

	{#if lightning}
		<Tip destination={lightning} style="mx-auto lg:!my-auto lg:h-[30px] block lg:inline" />
	{/if}
</div>
