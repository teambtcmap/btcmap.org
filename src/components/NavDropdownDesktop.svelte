<script lang="ts">
	import type { DropdownLink } from '$lib/types';
	import OutClick from 'svelte-outclick';

	export let title: string;
	export let links: DropdownLink[];
	export let top: string;
	export let bottom: string;

	let show = false;
</script>

<!-- dropdown menu -->
<div class="relative">
	<button
		id="dropdown-{title.toLowerCase()}"
		on:click={() => (show = !show)}
		class="{show
			? 'dark:!text-link'
			: ''} mr-4 mt-4 flex items-center text-xl font-semibold text-link transition-colors hover:text-hover dark:text-white dark:hover:text-link md:mr-0 md:mt-0"
	>
		{title} <i class="fa-solid fa-chevron-down ml-1 h-4 w-4" />
	</button>

	<!-- dropdown items -->
	{#if show}
		<OutClick
			excludeQuerySelectorAll={`#dropdown-${title.toLowerCase()}`}
			on:outclick={() => (show = false)}
		>
			<div class="absolute right-0 top-8 w-[185px] rounded-2xl shadow-lg">
				{#each links as link}
					<a
						href={link.url}
						target={link.external ? '_blank' : '_self'}
						rel="noreferrer"
						class="flex items-center justify-center bg-link p-4 text-xl font-semibold text-white hover:bg-hover {link.icon ===
						top
							? 'rounded-t-2xl'
							: link.icon === bottom
							  ? 'rounded-b-2xl'
							  : ''} transition-colors"
					>
						{link.title}
						{#if link.external}
							<i class="fa-solid fa-arrow-up-right-from-square ml-1 h-4 w-4" />
						{/if}
					</a>
				{/each}
			</div>
		</OutClick>
	{/if}
</div>
