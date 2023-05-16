<script>
	import Chart from 'chart.js/auto';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		Header,
		Footer,
		PrimaryButton,
		LeaderboardItem,
		LeaderboardSkeleton,
		TopButton,
		HeaderPlaceholder
	} from '$comp';
	import {
		users,
		userError,
		events,
		eventError,
		syncStatus,
		excludeLeader,
		theme
	} from '$lib/store';
	import { errToast, detectTheme, updateChartThemes } from '$lib/utils';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);

	let loading;
	let leaderboard;

	let topTenChartCanvas;
	let topTenChart;
	let chartsLoading;

	let initialRenderComplete = false;

	const populateLeaderboard = () => {
		loading = true;
		leaderboard = [];

		$users.forEach((user) => {
			if ($excludeLeader.includes(user.id)) {
				return;
			}

			let userEvents = $events.filter((event) => event['user_id'] == user.id);

			if (userEvents.length) {
				let created = userEvents.filter((event) => event.type === 'create').length;
				let updated = userEvents.filter((event) => event.type === 'update').length;
				let deleted = userEvents.filter((event) => event.type === 'delete').length;
				let profile = user['osm_json'];
				let avatar = profile.img ? profile.img.href : '/images/satoshi-nakamoto.png';

				leaderboard.push({
					avatar: avatar,
					tagger: profile['display_name'],
					id: user.id,
					created: user.id == '17221642' ? created + 100 : created,
					updated: user.id == '17221642' ? updated + 20 : updated,
					deleted: deleted,
					total:
						user.id == '17221642' ? created + updated + deleted + 120 : created + updated + deleted,
					tip: profile.description
				});
			}
		});

		leaderboard.sort((a, b) => b.total - a.total);
		leaderboard = leaderboard;

		loading = false;
	};

	const leaderboardSync = (status, users, events) => {
		if (users.length && events.length && !status && initialRenderComplete) {
			populateLeaderboard();

			let leaderboardCopy = [...leaderboard];
			leaderboardCopy = leaderboardCopy.slice(0, 10);
			chartsLoading = true;
			topTenChart.data.labels = leaderboardCopy.map(({ tagger }) => tagger);
			topTenChart.data.datasets[0].data = leaderboardCopy.map(({ total }) => total);
			topTenChart.update();
			chartsLoading = false;
		}
	};

	$: leaderboardSync($syncStatus, $users, $events);

	$: $theme !== undefined &&
		!chartsLoading &&
		initialRenderComplete === true &&
		updateChartThemes([topTenChart]);

	let leaderboardCount = 50;
	$: leaderboardPaginated =
		leaderboard && leaderboard.length && !loading && leaderboard.slice(0, leaderboardCount);

	onMount(() => {
		if (browser) {
			const theme = detectTheme();

			// setup leaderboard
			populateLeaderboard();

			// setup chart
			topTenChartCanvas.getContext('2d');

			let leaderboardCopy = [...leaderboard];
			leaderboardCopy = leaderboardCopy.slice(0, 10);

			topTenChart = new Chart(topTenChartCanvas, {
				type: 'bar',
				data: {
					labels: leaderboardCopy.map(({ tagger }) => tagger),
					datasets: [
						{
							label: 'Top Ten',
							data: leaderboardCopy.map(({ total }) => total),
							backgroundColor: 'rgba(247, 147, 26, 0.2)',
							borderColor: 'rgb(247, 147, 26)',
							borderWidth: 1
						}
					]
				},
				options: {
					maintainAspectRatio: false,
					plugins: {
						legend: {
							labels: {
								font: {
									weight: 600
								}
							}
						}
					},
					scales: {
						x: {
							ticks: {
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						},
						y: {
							beginAtZero: true,
							ticks: {
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						}
					}
				}
			});

			initialRenderComplete = true;
		}
	});

	const headings = ['Position', 'Supertagger', 'Created', 'Updated', 'Deleted', 'Tip'];
</script>

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
					Top Supertaggers
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="mx-auto w-full text-center text-xl font-semibold text-primary dark:text-white lg:w-[800px]"
			>
				Shadowy supertaggers are a competitive bunch. When they are not smashing the keys, they
				check this leaderboard to make sure they’re on top. Are you going to stand by and let them
				claim the top spot?! Get taggin’!
			</h2>

			<section id="chart" class="relative">
				<!-- eslint-disable-next-line svelte/valid-compile -->
				{#if leaderboard && leaderboard.length && !loading}{:else}
					<div class="absolute left-0 top-0 h-[400px] w-full animate-pulse border border-link/50" />
				{/if}
				<canvas bind:this={topTenChartCanvas} width="400" height="400" />
			</section>

			<PrimaryButton
				text="Smash these numbers"
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
				external
			/>

			<section id="leaderboard" class="dark:lg:rounded dark:lg:bg-white/10 dark:lg:py-8">
				<div class="mb-5 hidden grid-cols-6 text-center lg:grid">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary dark:text-white">
							{heading}
							{#if heading === 'Tip'}
								<a
									href="https://github.com/teambtcmap/btcmap-data/wiki/Lightning-Tips"
									target="_blank"
									rel="noreferrer"><i class="fa-solid fa-circle-info text-sm" /></a
								>
							{/if}
						</h3>
					{/each}
				</div>

				<div class="space-y-10 lg:space-y-5">
					{#if leaderboard && leaderboard.length && !loading}
						{#each leaderboardPaginated as item, index}
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

						{#if leaderboardPaginated.length !== leaderboard.length}
							<button
								class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
								on:click={() => (leaderboardCount = leaderboardCount + 50)}>Load More</button
							>
						{/if}
					{:else}
						<!-- eslint-disable-next-line no-unused-vars -->
						{#each Array(50) as skeleton}
							<LeaderboardSkeleton />
						{/each}
					{/if}
				</div>

				<p class="text-center text-sm text-body dark:text-white">*Data updated every 10 minutes</p>

				<div class="mt-10 flex justify-center">
					<TopButton />
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
