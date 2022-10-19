<script>
	import axios from 'axios';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, PrimaryButton, CommunityCard, CommunitySkeleton } from '$comp';
	import { socials } from '$lib/store';
	import { errToast } from '$lib/utils';

	let communitiesAPIInterval;
	let communities;

	onMount(async () => {
		if (browser) {
			const communitiesAPI = async () => {
				await axios
					.get('https://api.btcmap.org/v2/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter((area) => area.type !== 'country');

						communities.sort((a, b) => {
							const nameA = a.name.toUpperCase(); // ignore upper and lowercase
							const nameB = b.name.toUpperCase(); // ignore upper and lowercase
							if (nameA < nameB) {
								return -1;
							}
							if (nameA > nameB) {
								return 1;
							}

							// names must be equal
							return 0;
						});

						communities = communities;
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 10000);
		}
	});

	onDestroy(() => {
		clearInterval(communitiesAPIInterval);
	});
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center space-y-10 my-10 md:my-20">
			<h1 class="text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight">
				Communities
			</h1>

			<h2 class="text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				If 3.5% of your country’s businesses accepted Bitcoin, the adoption path to 100% is
				inevitable. Bitcoin communities are the spark that ignites the movement. Join your friends,
				onboard businesses and have fun! The party is just getting started.
			</h2>

			<PrimaryButton
				text="Add a local community"
				style="w-[200px] mx-auto py-3 rounded-xl"
				link={$socials.discord}
				external
			/>

			<section id="communities" class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
				{#if communities && communities.length}
					{#each communities as community}
						<CommunityCard name={community.name} id={community.id} tags={community.tags} />
					{/each}
				{:else}
					{#each Array(10) as skeleton}
						<CommunitySkeleton />
					{/each}
				{/if}
			</section>
		</main>

		<Footer style="justify-center" />
	</div>
</div>
