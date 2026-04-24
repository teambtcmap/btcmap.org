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

$: metaDescription = truncateAtWord(
	data.description?.replace(/\s+/g, " ").trim() ||
		$_("meta.countryFallbackDescription", {
			values: { name: countryDisplayName },
		}),
	200,
);

function truncateAtWord(s: string, max: number): string {
	if (s.length <= max) return s;
	const cut = s.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(" ");
	return `${lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut.trimEnd()}…`;
}

$: canonicalUrl = `https://btcmap.org/country/${encodeURIComponent(data.id)}/merchants`;
</script>

<svelte:head>
	<title>{countryDisplayName || $_('meta.country')}</title>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="description" content={metaDescription} />
	<meta property="og:image" content="https://btcmap.org/images/og/countries.png" />
	<meta property="og:title" content={countryDisplayName || $_('meta.country')} />
	<meta property="og:description" content={metaDescription} />
	<meta name="twitter:title" content={countryDisplayName || $_('meta.country')} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content="https://btcmap.org/images/og/countries.png" />
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="country" {data} />
