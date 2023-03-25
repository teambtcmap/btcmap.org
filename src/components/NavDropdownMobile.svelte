<script>
	import OutClick from 'svelte-outclick';
	import { Icon } from '$comp';

	export let title;
	export let icon;
	export let links;

	let show = false;
</script>

<!-- dropdown menu -->
<button
	id="dropdown-{title.toLowerCase()}-mobile"
	on:click={() => (show = !show)}
	class="w-full {show ? 'text-[#144046]' : 'text-link'} flex items-center text-xl"
>
	<span
		class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive dark:bg-white/[0.15] dark:active:bg-mobileButtonsActive"
	>
		<Icon w="24" h="24" icon={show ? `${icon}-highlight` : `${icon}`} type="mobile-nav" />
	</span>
	<span>{title}</span>
</button>

<!-- dropdown items -->
{#if show}
	<OutClick
		excludeQuerySelectorAll={[`#dropdown-${title.toLowerCase()}-mobile`]}
		on:outclick={() => (show = false)}
	>
		<div class="ml-7 space-y-2">
			{#each links as link}
				<a
					href={link.url}
					target={link.external ? '_blank' : '_self'}
					rel="noreferrer"
					class="flex w-full items-center text-xl text-link"
				>
					<span
						class="mr-4 rounded-full bg-mobileButtons p-3 transition-colors active:bg-mobileButtonsActive dark:bg-white/[0.15] dark:active:bg-mobileButtonsActive"
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
