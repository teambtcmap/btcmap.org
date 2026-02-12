<script lang="ts">
import { onMount } from "svelte";

import Icon from "$components/Icon.svelte";

import { resolve } from "$app/paths";
import { page } from "$app/stores";

onMount(() => {
	if ($page.status === 500 && !navigator.onLine) {
		location.reload();
	}
});
</script>

<svelte:head>
	<title>BTC Map - Error</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<div class="relative mx-auto w-10/12 xl:w-[1200px]">
		<header>
			<a href={resolve('/')}>
				<img src="/images/logo.svg" alt="logo" class="mx-auto w-32 py-5" />
			</a>
		</header>

		<div class="space-y-10 py-10 text-center">
			<a
				href={resolve('/')}
				class="text-xl font-semibold text-link transition-colors hover:text-hover"
				><Icon type="fa" icon="house" w="16" h="16" class="mr-2 inline" /> Home</a
			>
			<h1 class="text-4xl md:text-5xl dark:text-white">{$page.status}: {$page.error?.message}</h1>
			<h2 class="text-xl font-semibold text-primary dark:text-white">
				Please try again or contact BTC Map.
			</h2>
		</div>
	</div>
</div>
