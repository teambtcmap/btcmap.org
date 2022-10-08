<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, DashboardStat, LatestTagger, TaggerSkeleton } from '$comp';

	let statsAPIInterval;
	let communitiesAPIInterval;
	let supertaggersAPIInterval;

	let statsLoading;
	let communitiesLoading;
	let supertaggersLoading;

	let stats;
	let communities;
	let supertaggers;
	let users;

	const findUser = (tagger) => {
		const foundUser = users.find((user) => user.id == tagger['user_id']);
		if (foundUser) {
			return foundUser;
		} else {
			return tagger.user;
		}
	};

	$: total = stats && stats[0].total_elements;
	$: created = stats && stats[1].elements_created;
	$: updated = stats && stats[1].elements_updated;
	$: deleted = stats && stats[1].elements_deleted;
	$: onchain = stats && stats[0].total_elements_onchain;
	$: lightning = stats && stats[0].total_elements_lightning;
	$: nfc = stats && stats[0].total_elements_lightning_contactless;

	$: totalPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format((((total - stats[1].total_elements) / stats[1].total_elements) * 100).toFixed(1))
			.toString();

	$: createdPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(((created - stats[2].elements_created) / stats[2].elements_created) * 100).toFixed(1)
			)
			.toString();

	$: updatedPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(((updated - stats[2].elements_updated) / stats[2].elements_updated) * 100).toFixed(1)
			)
			.toString();

	$: deletedPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(((deleted - stats[2].elements_deleted) / stats[2].elements_deleted) * 100).toFixed(1)
			)
			.toString();

	$: onchainPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((onchain - stats[1].total_elements_onchain) / stats[1].total_elements_onchain) *
					100
				).toFixed(1)
			)
			.toString();

	$: lightningPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((lightning - stats[1].total_elements_lightning) / stats[1].total_elements_lightning) *
					100
				).toFixed(1)
			)
			.toString();

	$: nfcPercentChange =
		stats &&
		new Intl.NumberFormat('en-US', { signDisplay: 'always' })
			.format(
				(
					((nfc - stats[1].total_elements_lightning_contactless) /
						stats[1].total_elements_lightning_contactless) *
					100
				).toFixed(1)
			)
			.toString();

	onMount(async () => {
		if (browser) {
			const axios = await import('axios');

			const statsAPI = async () => {
				if (stats) {
					statsLoading = true;
				}

				await axios
					.get('https://api.btcmap.org/daily_reports')
					.then(function (response) {
						// handle success
						stats = response.data;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch stats data, please try again or contact BTC Map.');
						console.log(error);
					});

				statsLoading = false;
			};
			statsAPI();
			statsAPIInterval = setInterval(statsAPI, 600000);

			const communitiesAPI = async () => {
				if (communities) {
					communitiesLoading = true;
				}

				await axios
					.get('https://api.btcmap.org/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter((area) => area['area_type'] !== 'country');
						communities = communities;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});

				communitiesLoading = false;
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 600000);

			const supertaggersAPI = async () => {
				if (supertaggers) {
					supertaggersLoading = true;
				}

				await axios
					.get('https://api.btcmap.org/users')
					.then(function (response) {
						// handle success
						users = response.data;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch user profile data, please try again or contact BTC Map.');
						console.log(error);
					});

				await axios
					.get('https://api.btcmap.org/element_events')
					.then(function (response) {
						// handle success
						supertaggers = response.data.slice(0, 21);
						supertaggers = supertaggers;
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch latest supertaggers data, please try again or contact BTC Map.');
						console.log(error);
					});

				supertaggersLoading = false;
			};
			supertaggersAPI();
			supertaggersAPIInterval = setInterval(supertaggersAPI, 600000);
		}
	});

	onDestroy(() => {
		clearInterval(statsAPIInterval);
		clearInterval(communitiesAPIInterval);
		clearInterval(supertaggersAPIInterval);
	});
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-10 mt-10 mb-20">
			<h1
				class="text-center md:text-left text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Map Stats
			</h1>

			<h2 class="text-center md:text-left text-primary text-xl font-semibold w-full lg:w-[675px]">
				Shadowy Supertaggers don’t sleep. They are up all night, tagging away. The world we want is
				a tag away. Here are some stats for the MATH nerds.
			</h2>

			<section id="stats">
				<div class="border border-statBorder rounded-3xl grid md:grid-cols-2 xl:grid-cols-4">
					<DashboardStat
						title="Total Locations"
						stat={total}
						percent={totalPercentChange}
						border="border-b md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Created in last 24 hours"
						stat={created}
						percent={createdPercentChange}
						border="border-b xl:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Updated in last 24 hours"
						stat={updated}
						percent={updatedPercentChange}
						border="border-b md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Deleted in last 24 hours"
						stat={deleted}
						percent={deletedPercentChange}
						border="border-b border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Merchants accepting on-chain"
						stat={onchain}
						percent={onchainPercentChange}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Merchants accepting lightning"
						stat={lightning}
						percent={lightningPercentChange}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Merchants accepting contactless"
						stat={nfc}
						percent={nfcPercentChange}
						border="border-b md:border-b-0 md:border-r border-statBorder"
						loading={statsLoading}
					/>
					<DashboardStat
						title="Number of communities"
						stat={communities && communities.length}
						percent=""
						border=""
						loading={communitiesLoading}
					/>
				</div>
				<p class="text-sm text-body">
					*Data updated every 10 minutes, percentages based on previous 24 hours.
				</p>
			</section>

			<p class="text-center md:text-left text-xl text-primary">
				You too can be a shadowy supertagging legend! What are you waiting for? <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
					class="text-link hover:text-hover">Get taggin’!</a
				>
			</p>

			<section id="taggers">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3
						class="text-center md:text-left text-primary text-2xl border-b border-statBorder p-5 font-semibold"
					>
						Latest Supertaggers
						{#if supertaggersLoading}
							<svg
								class="inline animate-spin h-6 w-6 text-statPositive"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								/>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								/>
							</svg>
						{/if}
					</h3>

					<div class="space-y-5">
						{#if supertaggers && users}
							{#each supertaggers as tagger}
								<LatestTagger
									location={tagger['element_name']}
									action={tagger['event_type']}
									user={findUser(tagger)}
									time={tagger.date}
									latest={tagger === supertaggers[0] ? true : false}
									lat={tagger['element_lat']}
									long={tagger['element_lon']}
								/>
							{/each}
						{:else}
							<TaggerSkeleton />
							<TaggerSkeleton />
							<TaggerSkeleton />
						{/if}
					</div>
				</div>
				<p class="text-sm text-body">*Data updated every 10 minutes</p>
			</section>
		</main>

		<Footer style="justify-center md:justify-start" />
	</div>
</div>
