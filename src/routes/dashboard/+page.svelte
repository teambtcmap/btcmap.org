<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, DashboardStat, LatestTagger, TaggerSkeleton } from '$comp';
	import {
		users,
		userError,
		events,
		eventError,
		elements,
		elementError,
		syncStatus
	} from '$lib/store';
	import { errToast } from '$lib/utils';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);

	let statsAPIInterval;
	let communitiesAPIInterval;

	let statsLoading;
	let communitiesLoading;
	let elementsLoading;

	let stats;
	let communities;
	let supertaggers;

	const supertaggerSync = (status, users, events, elements) => {
		if (elements.length && events.length && users.length && !status) {
			let recentEvents = events.slice(0, 21);

			elementsLoading = true;
			supertaggers = [];

			recentEvents.forEach((event) => {
				let elementMatch = elements.find((element) => element.id === event['element_id']);

				if (elementMatch) {
					let location =
						elementMatch['osm_json'].tags && elementMatch['osm_json'].tags.name
							? elementMatch['osm_json'].tags.name
							: undefined;

					event.location = location ? location : 'Unnamed element';

					supertaggers.push(event);
				}
			});

			supertaggers = supertaggers;
			elementsLoading = false;
		}
	};

	$: supertaggerSync($syncStatus, $users, $events, $elements);

	$: latestTaggers =
		supertaggers &&
		supertaggers.length &&
		!elementsLoading &&
		supertaggers.find((tagger) => tagger.location)
			? true
			: false;

	const findUser = (tagger) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);
		if (foundUser) {
			return foundUser;
		} else {
			return '';
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
					.get('https://api.btcmap.org/v2/reports')
					.then(function (response) {
						// handle success
						stats = response.data.filter((report) => report['area_id'] === '');
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch stats data, please try again or contact BTC Map.');
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
					.get('https://api.btcmap.org/v2/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter((area) => area.type !== 'country');
						communities = communities;
					})
					.catch(function (error) {
						// handle error
						errToast('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});

				communitiesLoading = false;
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 600000);
		}
	});

	onDestroy(() => {
		clearInterval(statsAPIInterval);
		clearInterval(communitiesAPIInterval);
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
					</h3>

					<div class="space-y-5">
						{#if latestTaggers}
							{#each supertaggers as tagger}
								<LatestTagger
									location={tagger.location}
									action={tagger.type}
									user={findUser(tagger)}
									time={tagger.date}
									latest={tagger === supertaggers[0] ? true : false}
									lat={tagger['element_lat']}
									long={tagger['element_lon']}
								/>
							{/each}
						{:else}
							{#each Array(21) as skeleton}
								<TaggerSkeleton />
							{/each}
						{/if}
					</div>
				</div>
				<p class="text-sm text-body">*Data updated every 10 minutes</p>
			</section>
		</main>

		<Footer style="justify-center md:justify-start" />
	</div>
</div>
