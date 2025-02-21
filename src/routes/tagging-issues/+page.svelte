<script lang="ts">
	import { Footer, Header, HeaderPlaceholder, IssuesTable } from '$lib/comp';
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

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="mb-20 mt-10 space-y-10">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl font-semibold !leading-tight md:text-5xl lg:text-left"
				>
					Tagging Issues
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="w-full text-center text-xl font-semibold text-primary dark:text-white lg:w-[675px] lg:text-left"
			>
				Contribute to THE map by resolving tagging issues!
			</h2>

			<p class="text-center text-xl text-primary dark:text-white lg:text-left">
				More information about how to get involved can be found on our <a
					href="https://wiki.btcmap.org/general/tagging-instructions.html"
					class="text-link transition-colors hover:text-hover">Tagging Instructions</a
				>
				Wiki page.
			</p>
			<IssuesTable title="Global Issues" {issues} loading={false} initialPageSize={50} />
		</main>

		<Footer />
	</div>
</div>
