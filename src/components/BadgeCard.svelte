<script>
	export let icon;
	export let title;
	export let desc;
	export let type;
</script>

<div
	id={icon}
	class="relative space-y-4 rounded-3xl bg-white p-5 text-center drop-shadow-xl transition-all hover:drop-shadow-2xl md:p-10"
>
	{#if type === 'contribution'}
		<div
			class="absolute top-5 -right-2 w-20 rounded-full bg-white py-2 font-semibold text-link shadow-lg"
		>
			+{desc}
		</div>
	{/if}

	<img src="/icons/badges/{icon}.svg" alt={title} class="mx-auto h-20 w-20" />

	<p class="text-xl font-semibold text-primary">{title}</p>

	{#if type === 'achievement'}
		<p class="text-body">{desc}</p>
	{/if}
</div>
