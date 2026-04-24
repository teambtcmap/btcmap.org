<script lang="ts">
import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import type { AreaPageProps } from "$lib/types";
import { buildMetaDescription } from "$lib/utils";

import type { PageData } from "./$types";
import { browser } from "$app/environment";

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

// Chrome prefers the site-wide SVG favicon from app.html over any PNG
// we add in svelte:head, regardless of declaration order. Remove the
// app.html icon links (keeping only our community one) so the community
// icon actually shows in the tab.
$: if (browser && faviconUrl) {
	for (const link of document.querySelectorAll<HTMLLinkElement>(
		'link[rel="icon"]',
	)) {
		if (link.href !== faviconUrl) link.remove();
	}
}

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
