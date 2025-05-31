<script lang="ts">
	import {
		Footer,
		Header,
		HeaderPlaceholder,
		LatestTagger,
		TaggerSkeleton,
		TopButton
	} from '$lib/comp';
	import {
		elementError,
		elements,
		eventError,
		events,
		syncStatus,
		theme,
		userError,
		users
	} from '$lib/store';
	import type { ActivityEvent, Element, Event, User } from '$lib/types';
	import { detectTheme, errToast, formatElementID } from '$lib/utils';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);

	let elementsLoading: boolean;
	let supertaggers: ActivityEvent[];

	const findUser = (tagger: Event) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);
		if (foundUser) {
			return foundUser;
		} else {
			return undefined;
		}
	};

	const supertaggerSync = (
		status: boolean,
		users: User[],
		events: Event[],
		elements: Element[]
	) => {
		if (elements.length && events.length && users.length && !status) {
			let recentEvents = events
				.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
				.slice(0, 50);

			elementsLoading = true;
			supertaggers = [];

			recentEvents.forEach((event) => {
				let elementMatch = elements.find((element) => element.id === event['element_id']);

				let location =
					elementMatch?.['osm_json'].tags && elementMatch['osm_json'].tags.name
						? elementMatch['osm_json'].tags.name
						: undefined;

				let tagger = findUser(event);

				supertaggers.push({
					...event,
					location: location || formatElementID(event['element_id']),
					merchantId: event['element_id'],
					tagger
				});
			});

			supertaggers = supertaggers;
			elementsLoading = false;
		}
	};

	$: supertaggerSync($syncStatus, $users, $events, $elements);

	$: latestTaggers = supertaggers && supertaggers.length && !elementsLoading ? true : false;
</script>

<svelte:head>
	<title>BTC Map - Activity</title>
	<meta property="og:image" content="https://btcmap.org/images/og/activity.png" />
	<meta property="twitter:title" content="BTC Map - Activity" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/activity.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="mb-20 mt-10 space-y-10">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl font-semibold !leading-tight text-primary dark:text-white md:text-5xl lg:text-left"
				>
					Activity
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="w-full text-center text-xl font-semibold text-primary dark:text-white lg:w-[675px] lg:text-left"
			>
				Shadowy Supertaggers don’t sleep. They are up all night, tagging away. The world we want is
				a tag away.
			</h2>

			<p class="text-center text-xl text-primary dark:text-white lg:text-left">
				You too can be a shadowy supertagging legend! What are you waiting for? <a
					href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
					class="text-link transition-colors hover:text-hover">Get taggin’!</a
				>
			</p>

			<section id="taggers">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-2xl font-semibold text-primary dark:text-white lg:text-left"
					>
						Latest Supertaggers
					</h3>

					<div class="space-y-5">
						{#if latestTaggers}
							{#each supertaggers as tagger (tagger['created_at'])}
								<LatestTagger
									location={tagger.location}
									action={tagger.type}
									user={tagger.tagger}
									time={tagger['created_at']}
									latest={tagger === supertaggers[0] ? true : false}
									merchantId={tagger.merchantId}
								/>
							{/each}
						{:else}
							{#each Array(50) as _, index (index)}
								<TaggerSkeleton />
							{/each}
						{/if}
					</div>
				</div>
				<p class="text-center text-sm text-body dark:text-white lg:text-left">
					*Data updated every 10 minutes
				</p>
				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
