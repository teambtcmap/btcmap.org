<script>
	import OutClick from 'svelte-outclick';

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
	<img
		src={show ? `/icons/mobile-nav/${icon}-highlight.svg` : `/icons/mobile-nav/${icon}.svg`}
		alt={icon}
		class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3 transition-colors"
	/>
	<span>{title}</span>
</button>

<!-- dropdown items -->
{#if show}
	<OutClick
		excludeByQuerySelector={[`#dropdown-${title.toLowerCase()}-mobile`]}
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
					<img
						src="/icons/mobile-nav/{link.icon}.svg"
						alt={link.icon}
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3 transition-colors"
					/>
					<span>{link.title}</span>
					{#if link.external}
						<i class="ml-1 w-4 h-4 fa-solid fa-arrow-up-right-from-square" />
					{/if}
				</a>
			{/each}
		</div>
	</OutClick>
{/if}
