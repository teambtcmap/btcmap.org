<script>
	import { OutClick } from '$comp';

	export let title;
	export let links;
	export let top;
	export let bottom;

	let show = false;
</script>

<!-- dropdown menu -->
<div class="relative">
	<button
		id="dropdown-{title.toLowerCase()}"
		on:click={() => (show = !show)}
		class="mr-4 mt-4 md:mr-0 md:mt-0 text-link hover:text-hover text-xl font-semibold flex items-center transition-colors"
	>
		{title} <i class="ml-1 w-4 h-4 fa-solid fa-chevron-down" />
	</button>

	<!-- dropdown items -->
	{#if show}
		<OutClick
			excludeByQuerySelector={[`#dropdown-${title.toLowerCase()}`]}
			on:outclick={() => (show = false)}
		>
			<div class="w-[170px] absolute top-8 right-0 rounded-2xl shadow-lg">
				{#each links as link}
					<a
						href={link.url}
						target={link.external ? '_blank' : '_self'}
						rel="noreferrer"
						class="p-4 block bg-link hover:bg-hover text-white text-xl font-semibold flex justify-center items-center {link.icon ===
						top
							? 'rounded-t-2xl'
							: link.icon === bottom
							? 'rounded-b-2xl'
							: ''} transition-colors"
					>
						{link.title}
						{#if link.external}
							<i class="ml-1 w-4 h-4 fa-solid fa-arrow-up-right-from-square" />
						{/if}
					</a>
				{/each}
			</div>
		</OutClick>
	{/if}
</div>
