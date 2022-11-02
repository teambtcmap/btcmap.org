<script>
	export let icon;
	export let title;
	export let desc;
	export let type;
</script>

<div
	id={icon}
	class="bg-white drop-shadow-xl hover:drop-shadow-2xl rounded-3xl p-5 md:p-10 space-y-4 text-center relative transition-all"
>
	{#if type === 'contribution'}
		<div
			class="w-20 py-2 rounded-full shadow-lg text-link font-semibold bg-white absolute top-5 -right-2"
		>
			+{desc}
		</div>
	{/if}

	<img src="/icons/badges/{icon}.svg" alt={title} class="w-20 h-20 mx-auto" />

	<p class="text-primary text-xl font-semibold">{title}</p>

	{#if type === 'achievement'}
		<p class="text-body">{desc}</p>
	{/if}
</div>
