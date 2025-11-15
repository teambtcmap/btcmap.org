<script lang="ts">
	import AreaPage from '$components/AreaPage.svelte';
	import Breadcrumbs from '$components/Breadcrumbs.svelte';
	import Footer from '$components/Footer.svelte';
	import Header from '$components/Header.svelte';
	import type { AreaPageProps } from '$lib/types';
	import type { PageData } from './$types';

	export let data: PageData & AreaPageProps;

	const { name, id } = data;

	const routes = [
		{ name: 'Countries', url: '/countries' },
		{ name, url: `/country/${id}` }
	];
</script>

<svelte:head>
	<title>{name ? name + ' - ' : ''}BTC Map Country</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="twitter:title" content="{name ? name + ' - ' : ''}BTC Map Country" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<Breadcrumbs {routes} />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<AreaPage type="country" {data} />

		<Footer />
	</div>
</div>
