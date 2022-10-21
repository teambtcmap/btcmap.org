<script>
	import { LoadingSpinner } from '$comp';

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
			<a href="/communities"><i class="fa-solid fa-circle-info text-base" /></a>
		{/if}
		{#if loading}
			<LoadingSpinner color="text-link" style="inline" />
		{/if}
	</h3>
	<div class="flex justify-center md:justify-start">
		{#if stat >= 0}
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
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50" />
		{/if}
	</div>
</div>
