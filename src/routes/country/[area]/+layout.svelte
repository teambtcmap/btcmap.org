<script lang="ts">
import AreaLayout from "$components/area/AreaLayout.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { getCountryName } from "$lib/countryNames";
import { _, locale } from "$lib/i18n";
import { buildMetaDescription } from "$lib/utils";

import { page } from "$app/state";

let { children } = $props();

// page.data is rune-backed — directly reactive in runes mode, no bridge.
const data = $derived(page.data);

let _nameGen = 0;
let countryDisplayName = $state(page.data.name ?? "");

// $derived can't express an async lookup, so the old reactive block's
// generation guard is ported verbatim: bump the token, set the fallback
// synchronously, then only apply the resolved name if no newer run has
// started (stale promises from a fast X→Y area switch never clobber it).
$effect(() => {
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
});

const routes = $derived([
	{ name: $_("nav.countries"), url: "/countries" },
	{
		name: countryDisplayName,
		url: `/country/${encodeURIComponent(data.id)}`,
	},
]);

const metaDescription = $derived(
	buildMetaDescription(
		data.description,
		$_("meta.countryFallbackDescription", {
			values: { name: countryDisplayName },
		}),
		200,
	),
);

const canonicalUrl = $derived(
	`https://btcmap.org/country/${encodeURIComponent(data.id)}/merchants`,
);
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
<AreaLayout type="country">
	{@render children()}
</AreaLayout>
