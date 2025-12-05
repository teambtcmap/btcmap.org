<script lang="ts">
	import AreaPage from '$components/area/AreaPage.svelte';
	import Breadcrumbs from '$components/Breadcrumbs.svelte';
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

<Breadcrumbs {routes} />
<AreaPage type="country" {data} />
