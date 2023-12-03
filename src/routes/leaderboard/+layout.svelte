<script lang="ts">
	import { LoadingSplash } from '$lib/comp';
	import { eventError, events, userError, users } from '$lib/store';
</script>

<svelte:head>
	<title>BTC Map - Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

{#if ($users && $users.length && $events && $events.length) || $userError || $eventError}
	<slot />
{:else}
	<LoadingSplash page="leaderboard" />
{/if}
