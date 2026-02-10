<script lang="ts">
	export let type: string;
	export let text: string;
	export let issue: number | undefined = undefined;
	export let buttonWidth = 'w-52';
	export let repo: 'btcmap-data' | 'btcmap-infra' = 'btcmap-data';
	export let showIssueLink = true;

	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import PrimaryButton from '$components/PrimaryButton.svelte';
	import { theme } from '$lib/theme';
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
		<p class="mb-5 w-full text-primary md:w-[500px] dark:text-white">
			{text}
			{#if showIssueLink && issue}
				You may also monitor the progress of your submission here:
				<a
					href="https://gitea.btcmap.org/teambtcmap/{repo}/issues/{issue}"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">Issue #{issue}</a
				>.
			{/if}
		</p>

		<PrimaryButton on:click style="{buttonWidth} py-3 mx-auto mt-10 rounded-xl">
			Submit another {type.toLowerCase()}
		</PrimaryButton>
	</div>
</div>
