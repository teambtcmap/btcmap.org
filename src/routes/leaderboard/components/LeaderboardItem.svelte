<script lang="ts">
export let position: number;
export let avatar: string;
export let tagger: string;
export let id: number;
export let created: number;
export let updated: number;
export let deleted: number;
export let tip: string;

import Tip from "$components/Tip.svelte";

import { resolve } from "$app/paths";

$: stats = [
	{ stat: created, title: "C" },
	{ stat: updated, title: "U" },
	{ stat: deleted, title: "D" },
];

$: regexMatch = tip?.match("(lightning:[^)]+)");
$: lightning = regexMatch?.[0].slice(10);
</script>

<div
	class="grid-cols-6 space-y-5 border-t border-b border-gray-300 py-5 text-center text-lg font-semibold lg:grid lg:space-y-0 lg:border-none lg:py-0 dark:border-white/95"
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

	<div class="flex flex-col items-center gap-2 lg:flex-row">
		<img
			src={avatar}
			alt="avatar"
			class="h-20 w-20 rounded-full object-cover lg:h-14 lg:w-14"
			on:error={function () {
				this.src = '/images/satoshi-nakamoto.png';
			}}
		/>

		<a
			href={resolve(`/tagger/${id}`)}
			class="text-link hover:text-hover lg:text-left {tagger.match('([^ ]{16})')
				? 'break-all'
				: ''} transition-colors">{tagger}</a
		>
	</div>

	{#each stats as stat (stat.title)}
		<span class="mx-5 inline-block text-link lg:mx-0 lg:!my-auto">
			<span
				class="mr-1 inline-block h-3 w-3 rounded-full {stat.title === 'C'
					? 'bg-created'
					: stat.title === 'U'
						? 'bg-link'
						: 'bg-deleted'} lg:hidden"
			/>{stat.stat}
		</span>
	{/each}

	{#if lightning}
		<Tip destination={lightning} class="mx-auto block lg:!my-auto lg:h-[30px]" />
	{/if}
</div>
