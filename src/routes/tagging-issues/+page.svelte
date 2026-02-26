<script lang="ts">
import IssuesTable from "$components/IssuesTable.svelte";
import HeaderPlaceholder from "$components/layout/HeaderPlaceholder.svelte";
import { _ } from "$lib/i18n";
import { theme } from "$lib/theme";
import type { RpcIssue } from "$lib/types";

export let data;
let issues: RpcIssue[] = data.rpcResult.requested_issues;
</script>

<svelte:head>
	<title>BTC Map - {$_("taggingIssues.heading")}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta name="twitter:title" content="BTC Map - {$_("taggingIssues.heading")}" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="mt-10 mb-20 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{$theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl lg:text-left"
		>
			{$_("taggingIssues.heading")}
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="w-full text-center text-xl font-semibold text-primary lg:w-[675px] lg:text-left dark:text-white"
	>
		{$_("taggingIssues.subheading")}
	</h2>

	<p class="text-center text-xl text-primary lg:text-left dark:text-white">
		{$_("taggingIssues.descriptionPart1")}<a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants"
			class="text-link transition-colors hover:text-hover">{$_("taggingIssues.linkText")}</a
		>{$_("taggingIssues.descriptionPart2")}
	</p>
	<IssuesTable title={$_("taggingIssues.tableTitle")} {issues} loading={false} initialPageSize={50} />
</div>
