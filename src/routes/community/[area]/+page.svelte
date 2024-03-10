<script lang="ts">
	export let data: AreaPageProps;

	import { AreaPage, Footer, Header } from '$lib/comp';
	import type { AreaPageProps } from '$lib/types';

	const { name } = data;
</script>

<svelte:head>
	<title>{name ? name + ' - ' : ''}BTC Map Community</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="{name ? name + ' - ' : ''}BTC Map Community" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<AreaPage type="community" {data} />

		<Footer />
	</div>
</div>
