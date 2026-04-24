<script lang="ts">
import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

$: routes = [
	{ name: $_("nav.communities"), url: "/communities" },
	{ name: data.name, url: `/community/${encodeURIComponent(data.id)}` },
];

$: metaDescription = truncateAtWord(
	data.description?.replace(/\s+/g, " ").trim() ||
		$_("meta.communityFallbackDescription", { values: { name: data.name } }),
	200,
);

function truncateAtWord(s: string, max: number): string {
	const codePoints = Array.from(s);
	if (codePoints.length <= max) return s;
	const cut = codePoints.slice(0, max - 1).join("");
	const lastSpace = cut.lastIndexOf(" ");
	return `${lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut.trimEnd()}…`;
}

$: faviconUrl = data.iconSquare
	? `https://btcmap.org/.netlify/images?url=${encodeURIComponent(data.iconSquare)}&fit=cover&w=64&h=64`
	: null;

$: canonicalUrl = `https://btcmap.org/community/${encodeURIComponent(data.id)}/merchants`;
</script>

<svelte:head>
	<title>{data.name || $_('meta.community')}</title>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="description" content={metaDescription} />
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content={data.name || $_('meta.community')} />
	<meta property="og:description" content={metaDescription} />
	<meta name="twitter:title" content={data.name || $_('meta.community')} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
	{#if faviconUrl}
		<link rel="icon" href={faviconUrl} />
		<link rel="apple-touch-icon" href={faviconUrl} />
	{/if}
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="community" {data} />
