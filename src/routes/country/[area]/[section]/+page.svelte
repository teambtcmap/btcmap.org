<script lang="ts">
import { _, locale } from "svelte-i18n";

import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { getCountryName } from "$lib/countryNames";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

$: routes = [
	{ name: $_(`nav.countries`), url: "/countries" },
	{
		name: getCountryName(data.id ?? "", $locale ?? "en", data.name ?? ""),
		url: `/country/${data.id}`,
	},
];
</script>

<svelte:head>
	<title>{data.name ? data.name + ' - ' : ''}BTC Map Country</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="twitter:title" content="{data.name ? data.name + ' - ' : ''}BTC Map Country" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="country" {data} />
