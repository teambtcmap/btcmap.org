<script>
	import { OutClick } from '$comp';

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
		class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3"
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
				<a href={link.url} class="w-full text-link text-xl flex items-center">
					<img
						src="/icons/mobile-nav/{link.icon}.svg"
						alt={link.icon}
						class="mr-4 bg-mobileButtons active:bg-mobileButtonsActive rounded-full p-3"
					/>
					<span>{link.title}</span>
				</a>
			{/each}
		</div>
	</OutClick>
{/if}
