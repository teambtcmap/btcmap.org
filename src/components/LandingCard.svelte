<!-- this component is no longer used but could be used again in the future -->
<script>
	export let image;
	export let text;
	export let link;
</script>

<div class="mb-20">
	{#if link}
		<a
			href={link}
			target="_blank"
			rel="noreferrer"
			class="text-link hover:text-hover text-2xl font-semibold"
		>
			<div
				class="bg-offwhite rounded-2xl p-5 mb-5 w-full md:w-[22rem] xl:w-full h-60 flex justify-center items-center"
			>
				<img src="/images/{image}.png" alt={image} />
			</div>
			<p>{text}</p>
		</a>
	{:else}
		<div
			class="bg-offwhite rounded-2xl p-5 mb-5 w-full md:w-[22rem] xl:w-auto h-60 flex justify-center items-center"
		>
			<img src="/images/{image}.png" alt={image} />
		</div>
		<p class="text-primary text-2xl font-semibold">{text}</p>
	{/if}
</div>
