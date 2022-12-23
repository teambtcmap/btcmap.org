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
	class="w-full {show ? 'text-[#144046]' : 'text-link'} text-xl flex items-center"
>
	<span
		class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3 transition-colors"
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
					class="w-full text-link text-xl flex items-center"
				>
					<span
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3 transition-colors"
					>
						<Icon w="24" h="24" icon={link.icon} type="mobile-nav" />
					</span>
					<span>{link.title}</span>
					{#if link.external}
						<i class="ml-1 w-4 h-4 fa-solid fa-arrow-up-right-from-square" />
					{/if}
				</a>
			{/each}
		</div>
	</OutClick>
{/if}
