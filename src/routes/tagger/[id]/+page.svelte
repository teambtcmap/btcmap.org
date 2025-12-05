<script lang="ts">
	import type { PageData } from './$types';
	export let data: PageData;

	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import ProfileActivity from './components/ProfileActivity.svelte';
	import ProfileStat from '$components/ProfileStat.svelte';
	import Tip from '$components/Tip.svelte';
	import Icon from '$components/Icon.svelte';
	import {
		placesError,
		eventError,
		events,
		excludeLeader,
		places,
		userError,
		users
	} from '$lib/store';
	import {
		BadgeType,
		type ActivityEvent,
		type EarnedBadge,
		type ProfileLeaderboard
	} from '$lib/types.js';
	import { eventsSync } from '$lib/sync/events';
	import { usersSync } from '$lib/sync/users';
	import { batchSync } from '$lib/sync/batchSync';
	import { errToast, formatElementID } from '$lib/utils';
	import Chart from 'chart.js/auto';
	import { format } from 'date-fns';
	import DOMPurify from 'dompurify';
	import { marked } from 'marked';
	import { onMount } from 'svelte';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $placesError && errToast($placesError);

	let dataInitialized = false;
	let initialRenderComplete = false;

	let filteredDesc: string | undefined;
	let sanitizedMarkdown: string = '';

	const initializeData = async () => {
		if (dataInitialized) return;

		const userFound = $users.find((user) => user.id == data.user);
		if (!userFound) {
			console.error('Could not find user, please try again or contact BTC Map.');
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/404');
			return;
		}
		userCreated = userFound['created_at'];
		supporter = Boolean(
			userFound.tags['supporter:expires'] &&
			Date.parse(userFound.tags['supporter:expires']) > Date.now()
		);
		const user = userFound['osm_json'];
		avatar = user.img ? user.img.href : '/images/satoshi-nakamoto.png';
		mappingSince = user['account_created'];
		const description = user.description;
		const removeLightning = description.match(/(\[⚡]\(lightning:[^)]+\))/g);
		filteredDesc = removeLightning?.length
			? description.replaceAll(removeLightning[0], '')
			: description;
		const regexMatch = description.match('(lightning:[^)]+)');
		lightning = regexMatch && regexMatch[0].slice(10);

		const userEvents = $events.filter((event) => event['user_id'] == user.id);
		userEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));
		created =
			user.id === 17221642
				? userEvents.filter((event) => event.type === 'create').length + 100
				: userEvents.filter((event) => event.type === 'create').length;
		updated =
			user.id === 17221642
				? userEvents.filter((event) => event.type === 'update').length + 20
				: userEvents.filter((event) => event.type === 'update').length;
		deleted = userEvents.filter((event) => event.type === 'delete').length;
		total = created + updated + deleted;

		const populateLeaderboard = () => {
			$users.forEach((user) => {
				if ($excludeLeader.includes(user.id)) {
					return;
				}

				let userEvents = $events.filter((event) => event['user_id'] == user.id);

				if (userEvents.length) {
					leaderboard.push({
						id: user.id,
						total: user.id === 17221642 ? userEvents.length + 120 : userEvents.length
					});
				}
			});

			leaderboard.sort((a, b) => b.total - a.total);
			leaderboard = leaderboard.slice(0, 10);
		};
		populateLeaderboard();

		const badges = [
			{
				check: [
					10396321, 17441326, 17199501, 668096, 17462838, 17221642, 5432507, 17354902, 18452174,
					18360665, 616774, 18062435, 7522075, 18380975, 1697546, 19288099, 11903494, 18552145,
					1836965, 19795869, 17872, 19768735, 17573979, 2929493, 19714509, 1851550, 18244560,
					19756689, 527105, 2339960, 17322349, 17300693, 1236325, 1787080
				].includes(user.id),
				title: 'Geyser Tournament',
				icon: 'geyser',
				type: BadgeType.Achievement
			},
			{ check: supporter, title: 'Supporter', icon: 'supporter', type: BadgeType.Achievement },
			{
				check: leaderboard[0].id == user.id,
				title: 'Top Tagger',
				icon: 'top-tagger',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(leaderboard.slice(0, 3).find((item) => item.id == user.id)),
				title: 'Podium',
				icon: 'podium',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(leaderboard.find((item) => item.id == user.id)),
				title: 'High Rank',
				icon: 'high-rank',
				type: BadgeType.Achievement
			},
			{
				check: Date.parse(userCreated) < new Date('December 26, 2022 00:00:00').getTime(),
				title: 'OG Supertagger',
				icon: 'og-supertagger',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(lightning),
				title: 'Lightning Junkie',
				icon: 'lightning-junkie',
				type: BadgeType.Achievement
			},
			{
				check: Boolean(user.img),
				title: 'Hello World',
				icon: 'hello-world',
				type: BadgeType.Achievement
			},
			{
				check: created > updated && created > deleted,
				title: 'Creator',
				icon: 'creator',
				type: BadgeType.Achievement
			},
			{
				check: updated > created && updated > deleted,
				title: 'Update Maxi',
				icon: 'update-maxi',
				type: BadgeType.Achievement
			},
			{
				check: deleted > created && deleted > updated,
				title: 'Demolition Specialist',
				icon: 'demolition-specialist',
				type: BadgeType.Achievement
			},
			{
				check: total >= 21000000,
				title: 'Hyperbitcoinisation',
				icon: 'hyperbitcoinisation',
				type: BadgeType.Contribution
			},
			{
				check: total >= 10000,
				title: 'Pizza Time',
				icon: 'pizza-time',
				type: BadgeType.Contribution
			},
			{ check: total >= 7777, title: 'Godly', icon: 'godly', type: BadgeType.Contribution },
			{ check: total >= 5000, title: 'Shadow', icon: 'shadow', type: BadgeType.Contribution },
			{
				check: total >= 3110,
				title: 'Whitepaper',
				icon: 'whitepaper',
				type: BadgeType.Contribution
			},
			{ check: total >= 1984, title: 'Winston', icon: 'winston', type: BadgeType.Contribution },
			{ check: total >= 1000, title: 'Whale', icon: 'whale', type: BadgeType.Contribution },
			{ check: total >= 821, title: 'Infinity', icon: 'infinity', type: BadgeType.Contribution },
			{ check: total >= 500, title: 'Legend', icon: 'legend', type: BadgeType.Contribution },
			{
				check: total >= 301,
				title: 'Chancellor',
				icon: 'chancellor',
				type: BadgeType.Contribution
			},
			{ check: total >= 256, title: 'SHA', icon: 'sha', type: BadgeType.Contribution },
			{
				check: total >= 210,
				title: 'No Bailouts',
				icon: 'no-bailouts',
				type: BadgeType.Contribution
			},
			{
				check: total >= 100,
				title: 'Supertagger',
				icon: 'supertagger',
				type: BadgeType.Contribution
			},
			{ check: total >= 69, title: 'ATH', icon: 'ath', type: BadgeType.Contribution },
			{
				check: total >= 51,
				title: 'Longest Chain',
				icon: 'longest-chain',
				type: BadgeType.Contribution
			},
			{ check: total >= 21, title: 'Satoshi', icon: 'satoshi', type: BadgeType.Contribution },
			{ check: total >= 10, title: 'Heartbeat', icon: 'heartbeat', type: BadgeType.Contribution },
			{ check: total >= 4, title: 'Segwit', icon: 'segwit', type: BadgeType.Contribution },
			{
				check: total >= 1,
				title: 'Whole Tagger',
				icon: 'whole-tagger',
				type: BadgeType.Contribution
			}
		];

		const addBadge = (check: boolean, title: string, icon: string, type: BadgeType) => {
			if (check) {
				earnedBadges.push({ title, icon, type });
			}
		};

		badges.some((badge) => {
			if (earnedBadges.find((badge) => badge.type === BadgeType.Contribution)) {
				return true;
			}
			addBadge(Boolean(badge.check), badge.title, badge.icon, badge.type);
		});

		createdPercent = new Intl.NumberFormat('en-US').format(
			Number((created / (total / 100)).toFixed(0))
		);

		updatedPercent = new Intl.NumberFormat('en-US').format(
			Number((updated / (total / 100)).toFixed(0))
		);

		deletedPercent = new Intl.NumberFormat('en-US').format(
			Number((deleted / (total / 100)).toFixed(0))
		);

		// Create activity events without fetching element data - names will be fetched on-demand
		eventElements = userEvents.map((event) => {
			return {
				...event,
				location: formatElementID(event.element_id), // Will be updated with actual names on-demand
				merchantId: event.element_id
			};
		});

		// add markdown support for profile description
		const markdown = await marked.parse(filteredDesc || '');
		sanitizedMarkdown = DOMPurify.sanitize(markdown);

		const setupChart = () => {
			tagTypeChart = new Chart(tagTypeChartCanvas, {
				type: 'pie',
				data: {
					labels: ['Created', 'Updated', 'Deleted'],
					datasets: [
						{
							label: 'Tag Types',
							data: [created, updated, deleted],
							backgroundColor: ['rgb(16, 183, 145)', 'rgb(0, 153, 175)', 'rgb(235, 87, 87)'],
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
		};
		setupChart();

		// eslint-disable-next-line svelte/infinite-reactive-loop
		dataInitialized = true;
	};

	$: $users &&
		$users.length &&
		$events &&
		$events.length &&
		$places &&
		$places.length &&
		initialRenderComplete &&
		!dataInitialized &&
		// eslint-disable-next-line svelte/infinite-reactive-loop
		initializeData();

	let userCreated: string | undefined;
	let supporter: boolean | undefined;
	let avatar: string | undefined;
	let mappingSince: string | undefined;
	let username = data.username;

	let lightning: string | null;

	let created: number | undefined;
	let updated: number | undefined;
	let deleted: number | undefined;
	let total: number | undefined;

	let leaderboard: ProfileLeaderboard[] = [];

	let earnedBadges: EarnedBadge[] = [];

	let createdPercent: string | undefined;
	let updatedPercent: string | undefined;
	let deletedPercent: string | undefined;

	let tagTypeChartCanvas: HTMLCanvasElement;
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	let tagTypeChart;

	let eventElements: ActivityEvent[] = [];

	let loadingNames = false;
	let nameCache: Record<string, string> = {};

	// Fetch place names for current page
	const fetchPageNames = async (events: ActivityEvent[]) => {
		if (loadingNames) return;
		loadingNames = true;

		const uniqueIds = [...new Set(events.map((event) => event.element_id))];
		const idsToFetch = uniqueIds.filter((id) => !nameCache[id]);

		if (idsToFetch.length > 0) {
			const promises = idsToFetch.map(async (id) => {
				try {
					const response = await fetch(`https://api.btcmap.org/v4/places/${id}?fields=name`);
					if (response.ok) {
						const data = await response.json();
						return { id, name: data.name || formatElementID(id) };
					}
					return { id, name: formatElementID(id) };
				} catch (error) {
					console.warn(`Failed to fetch name for ${id}:`, error);
					return { id, name: formatElementID(id) };
				}
			});

			const results = await Promise.all(promises);
			results.forEach(({ id, name }) => {
				nameCache[id] = name;
			});

			// Update eventElements with new names
			eventElements = eventElements.map((event) => ({
				...event,
				location: nameCache[event.element_id] || event.location
			}));
		}

		loadingNames = false;
	};

	// Handle fetch names event from ProfileActivity component
	const handleFetchNames = (event: CustomEvent) => {
		fetchPageNames(event.detail.events);
	};

	onMount(async () => {
		batchSync([eventsSync, usersSync]);

		if (browser) {
			// setup chart
			tagTypeChartCanvas.getContext('2d');

			initialRenderComplete = true;
		}
	});
</script>

<svelte:head>
	<title>{username ? username + ' - ' : ''}BTC Map Supertagger</title>
	<meta property="og:image" content="https://btcmap.org/images/og/supertagger.png" />
	<meta property="twitter:title" content="{username ? username + ' - ' : ''}BTC Map Supertagger" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/supertagger.png" />
</svelte:head>

<main class="my-10 text-center md:my-20">
	<section id="profile" class="space-y-8">
		{#if avatar}
			<img
				src={avatar}
				alt="avatar"
				class="mx-auto h-32 w-32 rounded-full object-cover"
				on:error={function () {
					this.src = '/images/satoshi-nakamoto.png';
				}}
			/>
		{:else}
			<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
		{/if}

		<div class="space-y-1">
			<h1 class="text-4xl !leading-tight font-semibold text-primary dark:text-white">
				{username || 'BTC Map Supertagger'}
			</h1>
			<p class="flex items-center justify-center space-x-1 text-sm text-primary dark:text-white">
				<Icon type="fa" icon="map-pin" w="16" h="16" />
				<span class="block">
					Mapping Since: {mappingSince ? format(new Date(mappingSince), 'yyyy-MM-dd') : '-'}
				</span>
			</p>
			{#if username}
				<a
					href="https://www.openstreetmap.org/user/{username}"
					target="_blank"
					rel="noreferrer"
					class="mx-auto flex w-24 items-center justify-center text-xs text-link transition-colors hover:text-hover"
					>OSM Profile <svg
						class="ml-1 w-3"
						width="16"
						height="16"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M3 13L13 3M13 3H5.5M13 3V10.5"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg></a
				>
			{/if}
		</div>

		<h2 class="mx-auto w-full text-xl break-all text-body lg:w-[800px] dark:text-white">
			<!-- eslint-disable-next-line svelte/no-at-html-tags - we even sanitize the captcha content above -->
			{@html sanitizedMarkdown}
		</h2>

		{#if lightning}
			<Tip destination={lightning} user={username} />
		{/if}
	</section>

	<section id="badges" class="mt-16">
		<div class="flex flex-wrap items-center justify-center">
			{#if dataInitialized}
				{#each earnedBadges as badge (badge.title)}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href="/badges#{badge.icon}" class="transition-transform hover:scale-110">
						<div class="mx-3 mb-6">
							<img
								src="/icons/badges/{badge.icon}.svg"
								alt={badge.title}
								class="mx-auto mb-1 h-24 w-24"
							/>
							<p class="text-center text-sm dark:text-white">{badge.title}</p>
						</div>
					</a>
				{/each}
			{:else}
				{#each Array(3) as _, i (i)}
					<div class="mx-3 mb-6">
						<div class="mx-auto mb-1 h-24 w-24 animate-pulse rounded-full bg-link/50" />
						<div class="mx-auto h-5 w-20 animate-pulse rounded bg-link/50" />
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section id="stats" class="mt-10 mb-16">
		<div
			class="grid rounded-t-3xl border border-gray-300 md:grid-cols-2 xl:grid-cols-4 dark:border-white/95 dark:bg-white/10"
		>
			<ProfileStat
				title="Total Tags"
				stat={total}
				border="border-b xl:border-b-0 md:border-r border-gray-300 dark:border-white/95"
			/>
			<ProfileStat
				title="Created"
				stat={created}
				percent={createdPercent}
				border="border-b xl:border-b-0 xl:border-r border-gray-300 dark:border-white/95"
			/>
			<ProfileStat
				title="Updated"
				stat={updated}
				percent={updatedPercent}
				border="border-b md:border-b-0 md:border-r border-gray-300 dark:border-white/95"
			/>
			<ProfileStat title="Deleted" stat={deleted} percent={deletedPercent} />
		</div>

		<div
			class="relative rounded-b-3xl border border-t border-gray-300 p-5 dark:border-white/95 dark:bg-white/10"
		>
			{#if !dataInitialized}
				<div>
					<Icon
						type="fa"
						icon="chart-pie"
						w="208"
						h="208"
						style="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse text-link/50"
					/>
				</div>
			{/if}

			<canvas bind:this={tagTypeChartCanvas} width="100%" height="250" />
		</div>
	</section>

	<section id="activity" class="my-16">
		<ProfileActivity
			{eventElements}
			{username}
			{dataInitialized}
			{loadingNames}
			on:fetchNames={handleFetchNames}
		/>
	</section>
</main>
