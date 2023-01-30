<script>
	export let title;
	export let supporters;
	export let placeholders;
</script>

<div>
	<h3 class="mb-4 text-xl font-semibold text-body">{title}</h3>
	<div class="mx-auto w-full grid-cols-3 gap-10 space-y-10 lg:grid lg:w-[830px] lg:space-y-0">
		{#each supporters as supporter}
			<a
				href={supporter.url}
				target="_blank"
				rel="noreferrer"
				class="mx-auto block w-full self-center md:w-[250px]"
			>
				<img
					src="/images/supporters/{supporter.logo}"
					alt={supporter.title}
					class="mx-auto w-[250px]"
				/>
			</a>
		{/each}
		<!-- supporter placeholders -->
		{#each Array(placeholders) as placeholder}
			<div
				class="mx-auto flex h-[90px] w-full items-center justify-center self-center rounded-xl bg-supporter/50 drop-shadow-xl md:w-[250px]"
			>
				<a href="mailto:hello@btcmap.org" class="uppercase text-white">Apply here</a>
			</div>
		{/each}
	</div>
</div>
