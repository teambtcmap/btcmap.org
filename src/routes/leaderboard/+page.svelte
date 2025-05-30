<script lang="ts">
	import { browser } from '$app/environment';
	import {
		Footer,
		Header,
		HeaderPlaceholder,
		LeaderboardItem,
		LeaderboardSkeleton,
		PrimaryButton
	} from '$lib/comp';
	import { theme } from '$lib/store';
	import type { RpcGetMostActiveUsersItem, TaggerLeaderboard } from '$lib/types';
	import { detectTheme } from '$lib/utils';
	import { onMount } from 'svelte';

	export let data;
	let users: RpcGetMostActiveUsersItem[] = data.rpcResult.users;

	let loading: boolean;
	let leaderboard: TaggerLeaderboard[];

	const populateLeaderboard = () => {
		loading = true;
		leaderboard = [];
		users.forEach((user) => {
			var image_url = 'satoshi';
			if (user.image_url) {
				image_url = user.image_url;
			}

			leaderboard.push({
				avatar: image_url,
				tagger: user.name,
				id: user.id,
				created: user.created,
				updated: user.updated,
				deleted: user.deleted,
				total: user.edits,
				tip: user.tip_address
			});
		});
		leaderboard = leaderboard;
		loading = false;
	};

	onMount(() => {
		if (browser) {
			populateLeaderboard();
		}
	});

	const headings = ['Position', 'Name', 'Created', 'Updated', 'Deleted', 'Tip'];
</script>

<svelte:head>
	<title>BTC Map - Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/leader.png" />
	<meta property="twitter:title" content="BTC Map - Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/leader.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />

	<main class="mt-10">
		<div class="mb-10 flex justify-center">
			<div id="hero" class="flex h-[324px] w-full items-end justify-center">
				<img src="/images/supertagger-king.svg" alt="ultimate supertagger" />
			</div>
		</div>

		<div class="mx-auto w-10/12 space-y-10 xl:w-[1200px]">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl font-semibold !leading-tight md:text-5xl"
				>
					Top Editors
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<PrimaryButton
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
				external
			>
				Join Them
			</PrimaryButton>

			<section id="leaderboard" class="dark:lg:rounded dark:lg:bg-white/10 dark:lg:py-8">
				<div class="mb-5 hidden grid-cols-6 text-center lg:grid">
					{#each headings as heading (heading)}
						<h3 class="text-lg font-semibold text-primary dark:text-white">
							{heading}
							{#if heading === 'Tip'}
								<a
									href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Lightning-Tips"
									target="_blank"
									rel="noreferrer"><i class="fa-solid fa-circle-info text-sm" /></a
								>
							{/if}
						</h3>
					{/each}
				</div>

				<div class="space-y-10 lg:space-y-5">
					{#if leaderboard && leaderboard.length && !loading}
						{#each leaderboard as item, index (item.id)}
							<LeaderboardItem
								position={index + 1}
								avatar={item.avatar}
								tagger={item.tagger}
								id={item.id}
								created={item.created}
								updated={item.updated}
								deleted={item.deleted}
								tip={item.tip}
							/>
						{/each}
					{:else}
						{#each Array(50) as _, i (i)}
							<LeaderboardSkeleton />
						{/each}
					{/if}
				</div>
			</section>

			<Footer />
		</div>
	</main>
</div>

<style>
	#hero {
		background-image: url('/images/confetti.png');
		background-repeat: no-repeat;
		background-position: center;
	}
</style>
