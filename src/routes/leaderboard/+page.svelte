<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import {
		Header,
		Footer,
		PrimaryButton,
		LeaderboardItem,
		LeaderboardSkeleton,
		TopButton
	} from '$comp';

	let leaderboardAPIInterval;
	let loading;

	let users;
	let events;
	let leaderboard;

	onMount(async () => {
		if (browser) {
			const axios = await import('axios');

			const leaderboardAPI = async () => {
				loading = true;
				leaderboard = [];

				await axios
					.get('https://api.btcmap.org/v2/users')
					.then(function (response) {
						// handle success
						users = response.data;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch users data, please try again or contact BTC Map.');
						console.log(error);
					});

				await axios
					.get('https://api.btcmap.org/v2/events')
					.then(function (response) {
						// handle success
						events = response.data;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch events data, please try again or contact BTC Map.');
						console.log(error);
					});

				if (users && events) {
					users.forEach((user) => {
						let userEvents = events.filter((event) => event['user_id'] == user.id);
						let created = userEvents.filter((event) => event.type === 'create');
						let updated = userEvents.filter((event) => event.type === 'update');
						let deleted = userEvents.filter((event) => event.type === 'delete');
						let profile = user['osm_json'];
						let avatar = profile.img ? profile.img.href : '/images/satoshi-nakamoto.png';

						leaderboard.push({
							avatar: avatar,
							tagger: profile['display_name'],
							created: created.length,
							updated: updated.length,
							deleted: deleted.length,
							tip: profile.description
						});
					});
				}

				leaderboard.sort(
					(a, b) => b.created + b.updated + b.deleted - (a.created + a.updated + a.deleted)
				);

				leaderboard = leaderboard;
				loading = false;
			};
			leaderboardAPI();
			leaderboardAPIInterval = setInterval(leaderboardAPI, 600000);
		}
	});

	onDestroy(() => {
		clearInterval(leaderboardAPIInterval);
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
				Top Shadowy Supertaggers
			</h1>

			<h2 class="text-center text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Shadowy supertaggers are a competitive bunch. When they are not smashing the keys, they
				check this leaderboard to make sure they’re on top. Are you going to stand by and let them
				claim the top spot?! Get taggin’!
			</h2>

			<PrimaryButton
				text="Smash these numbers"
				style="w-[207px] mx-auto py-3 rounded-xl"
				link="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
				external
			/>

			<section id="leaderboard">
				<div class="hidden lg:grid text-center grid-cols-6 mb-5">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary">{heading}</h3>
					{/each}
				</div>

				<div class="space-y-10 lg:space-y-5">
					{#if leaderboard && leaderboard.length && !loading}
						{#each leaderboard as item, index}
							<LeaderboardItem
								position={index + 1}
								avatar={item.avatar}
								tagger={item.tagger}
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
		</div>
	</main>

	<Footer style="justify-center" />
</div>

<style>
	#hero {
		background-image: url('/images/confetti.png');
		background-repeat: no-repeat;
		background-position: center;
	}
</style>
