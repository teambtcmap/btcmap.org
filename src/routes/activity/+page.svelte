<script lang="ts">
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import LatestTagger from '$components/LatestTagger.svelte';
	import TaggerSkeleton from '$components/TaggerSkeleton.svelte';
	import TopButton from '$components/TopButton.svelte';
	import { placesError, eventError, events, syncStatus, theme, userError, users } from '$lib/store';
	import { eventsSync } from '$lib/sync/events';
	import { usersSync } from '$lib/sync/users';
	import { batchSync } from '$lib/sync/batchSync';
	import type { ActivityEvent, Event, User } from '$lib/types';
	import { detectTheme, errToast, formatElementID } from '$lib/utils';
	import { onMount } from 'svelte';

	onMount(() => {
		batchSync([eventsSync, usersSync]);
	});

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $placesError && errToast($placesError);

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

	const fetchMerchantName = async (elementId: string): Promise<string> => {
		try {
			const response = await fetch(`https://api.btcmap.org/v2/elements/${elementId}`);
			if (!response.ok) throw new Error('API call failed');
			const data = await response.json();
			return data.osm_json?.tags?.name || formatElementID(elementId);
		} catch {
			return formatElementID(elementId);
		}
	};

	const supertaggerSync = async (status: boolean, users: User[], events: Event[]) => {
		if (events.length && users.length && !status) {
			let recentEvents = events
				.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
				.slice(0, 50);

			elementsLoading = true;
			supertaggers = [];

			// Fetch merchant names concurrently
			const supertaggerPromises = recentEvents.map(async (event) => {
				const location = await fetchMerchantName(event['element_id']);
				const tagger = findUser(event);

				return {
					...event,
					location,
					merchantId: event['element_id'],
					tagger
				};
			});

			try {
				supertaggers = await Promise.all(supertaggerPromises);
			} catch (error) {
				console.error('Error fetching merchant names:', error);
				// Fallback: create entries with element IDs only
				supertaggers = recentEvents.map((event) => ({
					...event,
					location: formatElementID(event['element_id']),
					merchantId: event['element_id'],
					tagger: findUser(event)
				}));
			}

			elementsLoading = false;
		}
	};

	$: supertaggerSync($syncStatus, $users, $events);

	$: latestTaggers = supertaggers && supertaggers.length && !elementsLoading ? true : false;
</script>

<svelte:head>
	<title>BTC Map - Activity</title>
	<meta property="og:image" content="https://btcmap.org/images/og/activity.png" />
	<meta property="twitter:title" content="BTC Map - Activity" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/activity.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold text-primary md:text-5xl lg:text-left dark:text-white"
		>
			Activity
		</h1>
	{:else}
		<HeaderPlaceholder />
	{/if}

	<h2
		class="w-full text-center text-xl font-semibold text-primary lg:w-[675px] lg:text-left dark:text-white"
	>
		Shadowy Supertaggers don’t sleep. They are up all night, tagging away. The world we want is a
		tag away.
	</h2>

	<p class="text-center text-xl text-primary lg:text-left dark:text-white">
		You too can be a shadowy supertagging legend! What are you waiting for? <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers-"
			class="text-link transition-colors hover:text-hover">Get taggin’!</a
		>
	</p>

	<section id="taggers">
		<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
			<h3
				class="border-b border-gray-300 p-5 text-center text-2xl font-semibold text-primary lg:text-left dark:border-white/95 dark:text-white"
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
		<p class="text-center text-sm text-body lg:text-left dark:text-white">
			*Data updated every 10 minutes
		</p>
		<div class="mt-10 flex justify-center">
			<TopButton />
		</div>
	</section>
</main>
