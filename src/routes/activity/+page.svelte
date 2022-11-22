<script>
	import { Header, Footer, LatestTagger, TaggerSkeleton, TopButton } from '$comp';
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
	import { latCalc, longCalc } from '$lib/map/setup';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);

	let elementsLoading;
	let supertaggers;

	const supertaggerSync = (status, users, events, elements) => {
		if (elements.length && events.length && users.length && !status) {
			let recentEvents = events
				.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
				.slice(0, 50);

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
					event.lat = latCalc(elementMatch['osm_json']);
					event.long = longCalc(elementMatch['osm_json']);

					supertaggers.push(event);
				}
			});

			supertaggers = supertaggers;
			elementsLoading = false;
		}
	};

	$: supertaggerSync($syncStatus, $users, $events, $elements);

	$: latestTaggers = supertaggers && supertaggers.length && !elementsLoading ? true : false;

	const findUser = (tagger) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);
		if (foundUser) {
			return foundUser;
		} else {
			return '';
		}
	};
</script>

<svelte:head>
	<title>BTC Map - Activity</title>
	<meta property="og:image" content="https://btcmap.org/images/og/activity.png" />
	<meta property="twitter:title" content="BTC Map - Activity" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/activity.png" />
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-10 mt-10 mb-20">
			<h1
				class="text-center lg:text-left text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Activity
			</h1>

			<h2 class="text-center lg:text-left text-primary text-xl font-semibold w-full lg:w-[675px]">
				Shadowy Supertaggers don’t sleep. They are up all night, tagging away. The world we want is
				a tag away.
			</h2>

			<p class="text-center lg:text-left text-xl text-primary">
				You too can be a shadowy supertagging legend! What are you waiting for? <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#shadowy-supertaggers"
					class="text-link hover:text-hover transition-colors">Get taggin’!</a
				>
			</p>

			<section id="taggers">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3
						class="text-center lg:text-left text-primary text-2xl border-b border-statBorder p-5 font-semibold"
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
									time={tagger['created_at']}
									latest={tagger === supertaggers[0] ? true : false}
									lat={tagger.lat}
									long={tagger.long}
								/>
							{/each}
						{:else}
							{#each Array(50) as skeleton}
								<TaggerSkeleton />
							{/each}
						{/if}
					</div>
				</div>
				<p class="text-sm text-body text-center lg:text-left">*Data updated every 10 minutes</p>
				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
