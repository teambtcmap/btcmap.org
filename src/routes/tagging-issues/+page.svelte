<script lang="ts">
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import IssuesTable from '$components/IssuesTable.svelte';
	import { theme } from '$lib/store';
	import { detectTheme } from '$lib/utils';
	import type { RpcIssue } from '$lib/types';

	export let data;
	let issues: RpcIssue[] = data.rpcResult.requested_issues;
</script>

<svelte:head>
	<title>BTC Map - Tagging Issues</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Tagging Issues" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl lg:text-left"
		>
			Tagging Issues
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="w-full text-center text-xl font-semibold text-primary lg:w-[675px] lg:text-left dark:text-white"
	>
		Contribute to THE map by resolving tagging issues!
	</h2>

	<p class="text-center text-xl text-primary lg:text-left dark:text-white">
		More information about how to get involved can be found on our <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants"
			class="text-link transition-colors hover:text-hover">Tagging Instructions</a
		>
		Wiki page.
	</p>
	<IssuesTable title="Global Issues" {issues} loading={false} initialPageSize={50} />
</main>
