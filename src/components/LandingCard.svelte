<script>
	export let image;
	export let text;
	export let link;
</script>

<div class="mb-20">
	<div
		class="bg-offwhite rounded-2xl p-5 mb-5 w-full md:w-80 h-60 flex justify-center items-center"
	>
		<img src="/images/{image}.png" alt={image} />
	</div>

	{#if link}
		<a href={link} target="_blank" rel="noreferrer" class="text-link hover:text-hover text-2xl"
			>{text}</a
		>
	{:else}
		<p class="text-primary text-2xl">{text}</p>
	{/if}
</div>
