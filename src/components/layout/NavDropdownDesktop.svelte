<script lang="ts">
	import type { DropdownLink } from '$lib/types';
	import OutClick from 'svelte-outclick';
	import Icon from '$components/Icon.svelte';
	import { afterNavigate } from '$app/navigation';

	export let title: string;
	export let links: DropdownLink[];

	let show = false;

	afterNavigate(() => {
		show = false;
	});
</script>

<!-- dropdown menu -->
<div class="relative">
	<button
		id="dropdown-{title.toLowerCase()}"
		on:click={() => (show = !show)}
		aria-expanded={show}
		aria-haspopup="true"
		class="{show
			? 'dark:!text-link'
			: ''} mt-4 mr-4 flex items-center text-xl font-semibold text-link transition-colors hover:text-hover md:mt-0 md:mr-0 dark:text-white dark:hover:text-link"
	>
		{title}
		<Icon type="fa" icon="chevron-down" w="16" h="16" class="ml-1" aria-hidden="true" />
	</button>

	<!-- dropdown items -->
	{#if show}
		<OutClick
			excludeQuerySelectorAll={`#dropdown-${title.toLowerCase()}`}
			on:outclick={() => (show = false)}
		>
			<div class="absolute top-8 right-0 z-50 w-[185px] rounded-2xl shadow-lg">
				{#each links as link, i (link.url)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={link.url}
						target={link.external ? '_blank' : null}
						rel={link.rel || (link.external ? 'noopener noreferrer' : null)}
						class="flex w-full items-center justify-center bg-link p-4 text-center text-xl font-semibold text-white transition-colors hover:bg-hover {i ===
						0
							? 'rounded-t-2xl'
							: i === links.length - 1
								? 'rounded-b-2xl'
								: ''}"
					>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						{link.title}
						{#if link.external}
							<Icon
								type="fa"
								icon="arrow-up-right-from-square"
								w="16"
								h="16"
								class="ml-1"
								aria-hidden="true"
							/>
							<span class="sr-only">(opens in new tab)</span>
						{/if}
					</a>
				{/each}
			</div>
		</OutClick>
	{/if}
</div>
