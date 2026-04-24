<script lang="ts">
import AreaPage from "$components/area/AreaPage.svelte";
import Breadcrumbs from "$components/Breadcrumbs.svelte";
import { _ } from "$lib/i18n";
import type { AreaPageProps } from "$lib/types";

import type { PageData } from "./$types";

export let data: PageData & AreaPageProps;

const { name, id } = data;

$: routes = [
	{ name: $_("nav.communities"), url: "/communities" },
	{ name, url: `/community/${encodeURIComponent(id)}` },
];
</script>

<svelte:head>
	<title>{name || $_('meta.community')}</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="og:title" content={name || $_('meta.community')} />
	<meta name="twitter:title" content={name || $_('meta.community')} />
	<meta name="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<Breadcrumbs {routes} />
<AreaPage type="community" {data} />
