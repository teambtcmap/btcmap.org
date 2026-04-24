<script lang="ts">
import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

const { name, id, description, iconSquare } = data;

$: routes = [
	{ name: $_("nav.communities"), url: "/communities" },
	{ name, url: `/community/${encodeURIComponent(id)}` },
];

$: metaDescription = truncateAtWord(
	description?.replace(/\s+/g, " ").trim() ||
		$_("meta.communityFallbackDescription", { values: { name } }),
	200,
);

function truncateAtWord(s: string, max: number): string {
	if (s.length <= max) return s;
	const cut = s.slice(0, max - 1);
	const lastSpace = cut.lastIndexOf(" ");
	return `${lastSpace > max * 0.7 ? cut.slice(0, lastSpace) : cut.trimEnd()}…`;
}

$: faviconUrl = iconSquare
	? `https://btcmap.org/.netlify/images?url=${encodeURIComponent(iconSquare)}&fit=cover&w=64&h=64`
	: null;

$: canonicalUrl = `https://btcmap.org/community/${encodeURIComponent(id)}/merchants`;
</script>

<svelte:head>
	<title>{name || $_('meta.community')}</title>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="description" content={metaDescription} />
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content={name || $_('meta.community')} />
	<meta property="og:description" content={metaDescription} />
	<meta name="twitter:title" content={name || $_('meta.community')} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
	{#if faviconUrl}
		<link rel="icon" href={faviconUrl} />
		<link rel="apple-touch-icon" href={faviconUrl} />
	{/if}
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="community" {data} />
