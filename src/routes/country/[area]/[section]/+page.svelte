<script lang="ts">
import { _, locale } from "svelte-i18n";

import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { getCountryName } from "$lib/countryNames";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

let _nameGen = 0;
let countryDisplayName: string; // set by reactive block below
$: {
	const gen = ++_nameGen;
	const fallback = data.name ?? "";
	countryDisplayName = fallback;
	getCountryName(data.id ?? "", $locale ?? "en", fallback)
		.then((n) => {
			if (gen === _nameGen) countryDisplayName = n;
		})
		.catch(() => {
			// Keep fallback on error
		});
}

$: routes = [
	{ name: $_(`nav.countries`), url: "/countries" },
	{
		name: countryDisplayName,
		url: `/country/${data.id}`,
	},
];
</script>

<svelte:head>
	<title>{data.name ? data.name + ' - ' : ''}BTC Map Country</title>
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta name="twitter:title" content="{data.name ? data.name + ' - ' : ''}BTC Map Country" />
	<meta name="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="country" {data} />
