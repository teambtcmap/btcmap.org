<script lang="ts">
	export let type: string;
	export let text: string;
	export let issue: number;
	export let buttonWidth = 'w-52';

	import { HeaderPlaceholder, PrimaryButton } from '$lib/comp';
	import { socials, theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
</script>

<div class="mt-10 flex items-center justify-center pb-20 text-center md:pb-32">
	<div>
		{#if typeof window !== 'undefined'}
			<h2
				class="{detectTheme() === 'dark' || $theme === 'dark'
					? 'text-white'
					: 'gradient'} mb-5 text-4xl font-semibold"
			>
				{type} Submitted!
			</h2>
		{:else}
			<HeaderPlaceholder />
		{/if}
		<p class="mb-5 w-full text-primary dark:text-white md:w-[500px]">
			{text} You may also monitor the progress of your submission here:
			<a
				href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues/{issue}"
				target="_blank"
				rel="noreferrer"
				class="text-link transition-colors hover:text-hover">Issue #{issue}</a
			>.
		</p>

		<PrimaryButton
			text="Submit another {type.toLowerCase()}"
			on:click
			style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl"
		/>
	</div>
</div>
