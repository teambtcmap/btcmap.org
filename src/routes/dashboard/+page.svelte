<script>
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { Header, Footer, DashboardStat, LatestTagger, TaggerSkeleton } from '$comp';

	let statsAPIInterval;
	let communitiesAPIInterval;
	let supertaggersAPIInterval;

	let stats;
	let communities;
	let supertaggers;

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
			const statsAPI = () => {
				axios
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
			};
			statsAPI();
			statsAPIInterval = setInterval(statsAPI, 900000);

			const communitiesAPI = () => {
				axios
					.get('https://api.btcmap.org/areas')
					.then(function (response) {
						// handle success
						communities = response.data.filter((area) => area['area_type'] !== 'country');
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch communities data, please try again or contact BTC Map.');
						console.log(error);
					});
			};
			communitiesAPI();
			communitiesAPIInterval = setInterval(communitiesAPI, 900000);

			const supertaggersAPI = () => {
				axios
					.get('https://api.btcmap.org/element_events')
					.then(function (response) {
						// handle success
						supertaggers = response.data.slice(0, 21);
					})
					.catch(function (error) {
						// handle error
						alert('Could not fetch latest supertaggers data, please try again or contact BTC Map.');
						console.log(error);
					});
			};

			supertaggersAPI();
			supertaggersAPIInterval = setInterval(supertaggersAPI, 900000);
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
					/>
					<DashboardStat
						title="Created in last 24 hours"
						stat={created}
						percent={createdPercentChange}
						border="border-b xl:border-r border-statBorder"
					/>
					<DashboardStat
						title="Updated in last 24 hours"
						stat={updated}
						percent={updatedPercentChange}
						border="border-b md:border-r border-statBorder"
					/>
					<DashboardStat
						title="Deleted in last 24 hours"
						stat={deleted}
						percent={deletedPercentChange}
						border="border-b border-statBorder"
					/>
					<DashboardStat
						title="Merchants accepting on-chain"
						stat={onchain}
						percent={onchainPercentChange}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
					/>
					<DashboardStat
						title="Merchants accepting lightning"
						stat={lightning}
						percent={lightningPercentChange}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
					/>
					<DashboardStat
						title="Merchants accepting contactless"
						stat={nfc}
						percent={nfcPercentChange}
						border="border-b md:border-b-0 md:border-r border-statBorder"
					/>
					<DashboardStat
						title="Number of communities"
						stat={communities && communities.length}
						percent=""
						border=""
					/>
				</div>
				<p class="text-sm text-body">
					*Data updated every 15 minutes, percentages based on previous 24 hours.
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
						{#if supertaggers}
							{#each supertaggers as tagger}
								<LatestTagger
									location={tagger['element_name']}
									action={tagger['event_type']}
									user={tagger.user}
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
				<p class="text-sm text-body">*Data updated every 15 minutes</p>
			</section>
		</main>

		<Footer style="justify-center md:justify-start" />
	</div>
</div>
