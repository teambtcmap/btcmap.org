<script>
	import { users, userError, events, eventError, elements, elementError } from '$lib/store';
	import { errToast } from '$lib/utils';
	import { ProfileLoading } from '$comp';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);
</script>

<svelte:head>
	<title>BTC Map - Supertagger</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - Supertagger" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

{#if $users && $users.length && $events && $events.length && $elements && $elements.length}
	<slot />
{:else}
	<ProfileLoading />
{/if}
