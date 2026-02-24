<script lang="ts">
import { _, locale } from "svelte-i18n";

import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { getCountryName } from "$lib/countryNames";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

const { name, id } = data;

$: routes = [
	{ name: $_(`nav.countries`), url: "/countries" },
	{ name: getCountryName(id, $locale, name || ""), url: `/country/${id}` },
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
