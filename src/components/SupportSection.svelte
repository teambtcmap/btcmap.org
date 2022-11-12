<script>
	export let title;
	export let supporters;
	export let placeholders;
</script>

<div>
	<h3 class="mb-4 text-body text-xl font-semibold">{title}</h3>
	<div class="space-y-10 lg:space-y-0 lg:grid grid-cols-3 gap-10 w-full lg:w-[830px] mx-auto">
		{#each supporters as supporter}
			<a
				href={supporter.url}
				target="_blank"
				rel="noreferrer"
				class="self-center w-full md:w-[250px] mx-auto block"
			>
				<img
					src="/images/supporters/{supporter.logo}"
					alt={supporter.title}
					class="w-[250px] mx-auto"
				/>
			</a>
		{/each}
		<!-- supporter placeholders -->
		{#each Array(placeholders) as placeholder}
			<div
				class="self-center bg-supporter/50 w-full md:w-[250px] h-[90px] mx-auto drop-shadow-xl rounded-xl flex justify-center items-center"
			>
				<a href="mailto:hello@btcmap.org" class="text-white uppercase">Apply here</a>
			</div>
		{/each}
	</div>
</div>
