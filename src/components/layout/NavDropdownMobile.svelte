<script lang="ts">
	import Icon from '$components/Icon.svelte';
	import type { MobileNavIconName } from '$lib/icons/types';
	import IconMobileNav from '$lib/icons/IconMobileNav.svelte';
	import type { DropdownLink } from '$lib/types';
	import OutClick from 'svelte-outclick';

	export let title: string;
	export let icon: MobileNavIconName;
	export let links: DropdownLink[];

	let show = false;

	// Type assertion needed because template literal creates union of all possible strings
	$: displayIcon = (show ? `${icon}-highlight` : icon) as MobileNavIconName;
</script>

<!-- dropdown menu -->
<button
	id="dropdown-{title.toLowerCase()}-mobile"
	on:click={() => (show = !show)}
	aria-expanded={show}
	aria-haspopup="true"
	class="w-full {show ? 'text-[#144046]' : 'text-link'} flex items-center text-xl dark:text-white"
>
	<span
		class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive"
	>
		<IconMobileNav w="24" h="24" icon={displayIcon} />
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
			{#each links as link (link.title)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.url}
					target={link.external ? '_blank' : null}
					rel={link.rel || (link.external ? 'noopener noreferrer' : null)}
					class="flex w-full items-center text-xl text-link dark:text-white"
				>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
					<span
						class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive"
					>
						<IconMobileNav w="24" h="24" icon={link.icon} />
					</span>
					<span>{link.title}</span>
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
