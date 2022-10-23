<script>
	export let title;
	export let stat;
	export let percent;
	export let border;
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="font-semibold text-center md:text-left text-primary text-lg">
		{title}
	</h3>

	<div class="flex justify-center md:justify-start">
		{#if stat >= 0}
			<span class="text-5xl text-primary font-semibold">{stat}</span>
			{#if percent}
				<span class="ml-1 text-body text-lg">({percent}%)</span>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50" />
		{/if}
	</div>
</div>
