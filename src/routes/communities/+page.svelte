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
						communities = response.data.filter(
							(area) =>
								area.tags.type === 'community' &&
								area.tags['box:east'] &&
								area.tags['box:north'] &&
								area.tags['box:south'] &&
								area.tags['box:west'] &&
								area.tags.name &&
								area.tags['icon:square'] &&
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

						communities = communities;
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 600000);
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

			<section id="communities" class="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
				{#if communities && communities.length}
					{#each communities as community}
						<CommunityCard id={community.id} tags={community.tags} />
					{/each}
				{:else}
					{#each Array(10) as skeleton}
						<CommunitySkeleton />
					{/each}
				{/if}
			</section>
		</main>

		<Footer />
	</div>
</div>
