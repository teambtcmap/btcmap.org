<script>
	import { page } from '$app/stores';
	import {
		users,
		userError,
		events,
		eventError,
		elements,
		elementError,
		areas,
		areaError,
		reports,
		reportError
	} from '$lib/store';
	import { errToast } from '$lib/utils';
	import { LoadingSplash } from '$comp';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);
	// alert for area errors
	$: $areaError && errToast($areaError);
	// alert for report errors
	$: $reportError && errToast($reportError);
</script>

<svelte:head>
	<title>{$page.data.name ? $page.data.name + ' - ' : ''}BTC Map Merchant</title>
	<meta property="og:image" content="https://btcmap.org/images/og/merchant.png" />
	<meta
		property="twitter:title"
		content="{$page.data.name ? $page.data.name + ' - ' : ''}BTC Map Merchant"
	/>
	<meta property="twitter:image" content="https://btcmap.org/images/og/merchant.png" />
</svelte:head>

{#if $users && $users.length && $events && $events.length && $elements && $elements.length && $areas && $areas.length && $reports && $reports.length}
	<slot />
{:else}
	<LoadingSplash page="merchant" />
{/if}
