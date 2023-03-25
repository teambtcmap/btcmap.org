<script>
	import { LoadingSpinner } from '$comp';

	export let title;
	export let stat;
	export let percent = undefined;
	export let change = undefined;
	export let border = undefined;
	export let loading;
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-xl text-primary dark:text-white md:h-[56px] md:text-left">
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
			<span class="text-5xl font-semibold text-primary dark:text-white">{stat}</span>
			{#if percent !== undefined}
				<span
					class="{percent === '+0' || percent === 0
						? 'text-primary dark:text-white'
						: percent.startsWith('+')
						? 'text-statPositive'
						: 'text-statNegative'} ml-1 text-lg font-semibold"
					>{percent === '+0' ? percent.slice(1) : percent}%</span
				>
			{:else if change}
				<span
					class="{change === '+0'
						? 'text-primary dark:text-white'
						: change.startsWith('+')
						? 'text-statPositive'
						: 'text-statNegative'} ml-1 text-lg font-semibold">{change}</span
				>
			{/if}
		{:else}
			<!-- loading skeleton -->
			<span class="h-[48px] w-[150px] animate-pulse rounded-xl bg-link/50" />
		{/if}
	</div>
</div>
