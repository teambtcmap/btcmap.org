<script lang="ts">
	import AreaPage from '$components/area/AreaPage.svelte';
	import Breadcrumbs from '$components/Breadcrumbs.svelte';
	import type { AreaPageProps } from '$lib/types';
	import type { PageData } from './$types';

	export let data: PageData & AreaPageProps;

	const { name, id } = data;

	const routes = [
		{ name: 'Communities', url: '/communities' },
		{ name, url: `/community/${id}` }
	];
</script>

<svelte:head>
	<title>{name ? name + ' - ' : ''}BTC Map Community</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="{name ? name + ' - ' : ''}BTC Map Community" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="community" {data} />
