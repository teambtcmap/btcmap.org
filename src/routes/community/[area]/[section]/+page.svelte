<script lang="ts">
import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import type { AreaPageProps } from "$lib/types";
import { buildMetaDescription } from "$lib/utils";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

$: routes = [
	{ name: $_("nav.communities"), url: "/communities" },
	{ name: data.name, url: `/community/${encodeURIComponent(data.id)}` },
];

$: metaDescription = buildMetaDescription(
	data.description,
	$_("meta.communityFallbackDescription", { values: { name: data.name } }),
	200,
);

$: faviconUrl = data.iconSquare || null;

$: ogImage = data.iconSquare || "https://btcmap.org/images/og/communities.png";

$: canonicalUrl = `https://btcmap.org/community/${encodeURIComponent(data.id)}/merchants`;
</script>

<svelte:head>
	<title>{data.name || $_('meta.community')}</title>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="description" content={metaDescription} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:title" content={data.name || $_('meta.community')} />
	<meta property="og:description" content={metaDescription} />
	<meta name="twitter:title" content={data.name || $_('meta.community')} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={ogImage} />
	{#if faviconUrl}
		<link rel="icon" href={faviconUrl} />
		<link rel="apple-touch-icon" href={faviconUrl} />
	{/if}
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="community" {data} />
