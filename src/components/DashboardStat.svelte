<script lang="ts">
	import { LoadingSpinner } from '$lib/comp';

	export let title: string;
	export let stat: number | undefined;
	export let percent: undefined | string = undefined;
	export let change: undefined | string = undefined;
	export let border: undefined | string = undefined;
	export let loading: boolean;
</script>

<div class="space-y-5 p-5 {border}">
	<h3 class="text-center text-xl text-primary dark:text-white md:h-[56px] md:text-left">
		{title}
		{#if loading}
			<LoadingSpinner color="text-link" style="inline" />
		{/if}
	</h3>
	<div class="flex justify-center md:justify-start">
		{#if stat !== undefined}
			<span class="text-5xl font-semibold text-primary dark:text-white">
				{stat}{title === 'Up-To-Date Percent' ? '%' : ''}
			</span>
			{#if percent}
				<span
					class="{percent === '+0'
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
