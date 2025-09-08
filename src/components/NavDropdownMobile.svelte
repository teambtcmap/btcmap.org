<script lang="ts">
	import { Icon } from '$lib/comp';
	import type { DropdownLink } from '$lib/types';
	import OutClick from 'svelte-outclick';

	export let title: string;
	export let icon: string;
	export let links: DropdownLink[];

	let show = false;
</script>

<!-- dropdown menu -->
<button
	id="dropdown-{title.toLowerCase()}-mobile"
	on:click={() => (show = !show)}
	class="w-full {show ? 'text-[#144046]' : 'text-link'} flex items-center text-xl dark:text-white"
>
	<span
		class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive"
	>
		<Icon w="24" h="24" icon={show ? `${icon}-highlight` : `${icon}`} type="mobile-nav" />
	</span>
	<span>{title}</span>
</button>

<!-- dropdown items -->
{#if show}
	<OutClick
		excludeQuerySelectorAll={`#dropdown-${title.toLowerCase()}-mobile`}
		on:outclick={() => (show = false)}
	>
		<div class="ml-7 space-y-2">
			{#each links as link (link.url)}
				<a
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					href={link.url}
					target={link.external ? '_blank' : null}
					rel={link.external ? 'noreferrer' : null}
					class="flex w-full items-center text-xl text-link dark:text-white"
				>
					<span
						class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive"
					>
						<Icon w="24" h="24" icon={link.icon} type="mobile-nav" />
					</span>
					<span>{link.title}</span>
					{#if link.external}
						<i class="fa-solid fa-arrow-up-right-from-square ml-1 h-4 w-4" />
					{/if}
				</a>
			{/each}
		</div>
	</OutClick>
{/if}
