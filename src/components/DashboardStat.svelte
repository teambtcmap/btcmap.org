<script>
	export let title;
	export let stat;
	export let percent;
	export let border;
	export let loading;
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center md:text-left text-primary text-2xl md:h-[64px]">
		{title}
		{#if title === 'Number of communities'}
			<a
				href="https://github.com/teambtcmap/btcmap-data/wiki/Communities"
				target="_blank"
				rel="noreferrer"><i class="fa-solid fa-circle-info text-base" /></a
			>
		{/if}
		{#if loading}
			<svg
				class="inline animate-spin h-6 w-6 text-statPositive"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		{/if}
	</h3>
	<div class="flex justify-center md:justify-start">
		{#if stat}
			<span class="text-5xl text-primary font-semibold">{stat}</span>
			{#if percent}
				<span
					class="{percent === '+0'
						? 'text-primary'
						: percent.startsWith('+')
						? 'text-statPositive'
						: 'text-statNegative'} ml-1 font-semibold text-lg"
					>{percent === '+0' ? percent.slice(1) : percent}%</span
				>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-statPositive/50" />
		{/if}
	</div>
</div>
