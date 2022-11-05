<script>
	import axios from 'axios';
	import Chart from 'chart.js/dist/chart.min.js';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, PrimaryButton, CommunitySection } from '$comp';
	import { errToast } from '$lib/utils';

	let initialRenderComplete = false;
	let communitiesAPIInterval;
	let communities;
	let africa;
	let asia;
	let europe;
	let northAmerica;
	let oceania;
	let southAmerica;

	let continentChartCanvas;
	let continentChart;

	onMount(async () => {
		if (browser) {
			continentChartCanvas.getContext('2d');

			const communitiesAPI = async () => {
				await axios
					.get('https://api.btcmap.org/v2/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter(
							(area) =>
								area.tags.type === 'community' &&
								area.tags['box:east'] &&
								area.tags['box:north'] &&
								area.tags['box:south'] &&
								area.tags['box:west'] &&
								area.tags.name &&
								area.tags['icon:square'] &&
								area.tags.continent &&
								Object.keys(area.tags).find((key) => key.includes('contact'))
						);

						communities.sort((a, b) => {
							const nameA = a.tags.name.toUpperCase(); // ignore upper and lowercase
							const nameB = b.tags.name.toUpperCase(); // ignore upper and lowercase
							if (nameA < nameB) {
								return -1;
							}
							if (nameA > nameB) {
								return 1;
							}

							// names must be equal
							return 0;
						});

						africa = communities.filter((community) => community.tags.continent === 'africa');
						asia = communities.filter((community) => community.tags.continent === 'asia');
						europe = communities.filter((community) => community.tags.continent === 'europe');
						northAmerica = communities.filter(
							(community) => community.tags.continent === 'north-america'
						);
						oceania = communities.filter((community) => community.tags.continent === 'oceania');
						southAmerica = communities.filter(
							(community) => community.tags.continent === 'south-america'
						);

						// setup chart
						if (initialRenderComplete) {
							continentChart.data.datasets[0].data = [
								africa.length,
								asia.length,
								europe.length,
								northAmerica.length,
								oceania.length,
								southAmerica.length
							];
							continentChart.update();
						} else {
							continentChart = new Chart(continentChartCanvas, {
								type: 'doughnut',
								data: {
									labels: ['Africa', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'],
									datasets: [
										{
											label: 'Communities by Continent',
											data: [
												africa.length,
												asia.length,
												europe.length,
												northAmerica.length,
												oceania.length,
												southAmerica.length
											],
											backgroundColor: [
												'rgba(247, 147, 26, 1)',
												'rgba(11, 144, 114, 1)',
												'rgba(247, 147, 26, 0.7)',
												'rgba(11, 144, 114, 0.7)',
												'rgba(247, 147, 26, 0.35)',
												'rgba(11, 144, 114, 0.35)'
											],
											hoverOffset: 4
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
									}
								}
							});
						}
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});
			};
			await communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 10000);

			initialRenderComplete = true;
		}
	});

	onDestroy(() => {
		clearInterval(communitiesAPIInterval);
	});
</script>

<svelte:head>
	<title>BTC Map - Communities</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="BTC Map - Communities" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Join the bitcoin map community.
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Take ownership of your local bitcoin mapping data and help drive adoption. Bitcoin
				communities are the spark that ignites the movement. Join your friends, onboard businesses
				and have fun!
			</h2>

			<PrimaryButton
				text="Add a local community"
				style="w-[200px] mx-auto py-3 rounded-xl"
				link="/communities/add"
			/>

			<div class="relative">
				{#if !initialRenderComplete}
					<div
						class="absolute top-0 left-[calc(50%-150px)] bg-link/50 rounded-full animate-pulse w-[300px] h-[300px]"
					/>
				{/if}
				<canvas bind:this={continentChartCanvas} width="300" height="300" />
			</div>

			<div class="space-y-20">
				<CommunitySection title="Africa" communities={africa} />
				<CommunitySection title="Asia" communities={asia} />
				<CommunitySection title="Europe" communities={europe} />
				<CommunitySection title="North America" communities={northAmerica} />
				<CommunitySection title="Oceania" communities={oceania} />
				<CommunitySection title="South America" communities={southAmerica} />
			</div>
		</main>

		<Footer />
	</div>
</div>
