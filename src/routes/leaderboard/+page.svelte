<script>
	import Chart from 'chart.js/dist/chart.min.js';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import {
		Header,
		Footer,
		PrimaryButton,
		LeaderboardItem,
		LeaderboardSkeleton,
		TopButton
	} from '$comp';
	import { users, userError, events, eventError, syncStatus } from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);

	let loading;
	let leaderboard;

	let topTenChartCanvas;
	let topTenChart;

	let initialRenderComplete = false;

	const populateLeaderboard = () => {
		loading = true;
		leaderboard = [];

		$users.forEach((user) => {
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
		leaderboard = leaderboard.slice(0, 50);
		leaderboard = leaderboard;

		loading = false;
	};

	const leaderboardSync = (status, users, events) => {
		if (users.length && events.length && !status && initialRenderComplete) {
			populateLeaderboard();

			let leaderboardCopy = [...leaderboard];
			leaderboardCopy = leaderboardCopy.slice(0, 10);
			topTenChart.data.labels = leaderboardCopy.map(({ tagger }) => tagger);
			topTenChart.data.datasets[0].data = leaderboardCopy.map(({ total }) => total);
			topTenChart.update();
		}
	};

	$: leaderboardSync($syncStatus, $users, $events);

	onMount(() => {
		if (browser) {
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
							}
						},
						y: {
							beginAtZero: true,
							ticks: {
								font: {
									weight: 600
								}
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

<div class="bg-teal">
	<Header />

	<main class="mt-10 mb-20">
		<div class="flex justify-center mb-10">
			<div id="hero" class="w-full h-[324px] flex justify-center items-end">
				<img src="/images/supertagger-king.svg" alt="ultimate supertagger" />
			</div>
		</div>

		<div class="w-10/12 xl:w-[1200px] mx-auto space-y-10">
			<h1
				class="text-center text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Top Supertaggers
			</h1>

			<h2 class="text-center text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Shadowy supertaggers are a competitive bunch. When they are not smashing the keys, they
				check this leaderboard to make sure they’re on top. Are you going to stand by and let them
				claim the top spot?! Get taggin’!
			</h2>

			<section id="chart" class="relative">
				{#if leaderboard && leaderboard.length && !loading}{:else}
					<div class="absolute top-0 left-0 border border-link/50 animate-pulse w-full h-[400px]" />
				{/if}
				<canvas bind:this={topTenChartCanvas} width="400" height="400" />
			</section>

			<PrimaryButton
				text="Smash these numbers"
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
				external
			/>

			<section id="leaderboard">
				<div class="hidden lg:grid text-center grid-cols-6 mb-5">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary">
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
						{#each leaderboard as item, index}
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
						{#each Array(50) as skeleton}
							<LeaderboardSkeleton />
						{/each}
					{/if}
				</div>

				<p class="text-sm text-center text-body">*Data updated every 10 minutes</p>

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
