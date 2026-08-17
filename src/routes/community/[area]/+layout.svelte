<script lang="ts">
import AreaLayout from "$components/area/AreaLayout.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import { safeHttpUrl } from "$lib/safeUrl";
import type { AreaPageProps } from "$lib/types";
import { buildMetaDescription } from "$lib/utils";

import { page } from "$app/state";

let { children } = $props();

// page.data is rune-backed — directly reactive in runes mode, no bridge.
// Cast restores static typing: SvelteKit's page.data is App.PageData &
// Record<string, any>, so a bare read flows every field as any.
const data = $derived(page.data as AreaPageProps);

const routes = $derived([
	{ name: $_("nav.communities"), url: "/communities" },
	{ name: data.name, url: `/community/${encodeURIComponent(data.id)}` },
]);

const metaDescription = $derived(
	buildMetaDescription(
		data.description,
		$_("meta.communityFallbackDescription", { values: { name: data.name } }),
		200,
	),
);

// icon:square is an area tag — externally sourced. Fail closed: a
// non-http(s) or unparseable value drops the custom favicon (and the og
// image below falls back) rather than reaching href/content unvalidated.
const faviconUrl = $derived(safeHttpUrl(data.iconSquare));

// Chrome prefers the site-wide SVG favicon from app.html over any PNG we
// add in svelte:head, regardless of declaration order. Remove the
// app.html icon links (keeping only our community one) so the community
// icon actually shows in the tab. Effects never run during SSR, so the
// old `browser &&` guard is redundant here and has been dropped.
$effect(() => {
	if (faviconUrl) {
		for (const link of document.querySelectorAll<HTMLLinkElement>(
			'link[rel="icon"]',
		)) {
			if (link.href !== faviconUrl) link.remove();
		}
	}
});

const ogImage = $derived(
	faviconUrl || "https://btcmap.org/images/og/communities.png",
);

const canonicalUrl = $derived(
	`https://btcmap.org/community/${encodeURIComponent(data.id)}/merchants`,
);
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
		<link rel="icon" href={faviconUrl} referrerpolicy="no-referrer" />
		<link
			rel="apple-touch-icon"
			href={faviconUrl}
			referrerpolicy="no-referrer"
		/>
	{/if}
</svelte:head>

<Breadcrumbs {routes} />
<AreaLayout type="community">
	{@render children()}
</AreaLayout>
