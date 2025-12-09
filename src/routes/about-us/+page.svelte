<script lang="ts">
	import AboutCommunity from './components/AboutCommunity.svelte';
	import AboutContributor from './components/AboutContributor.svelte';
	import AboutCore from './components/AboutCore.svelte';
	import AboutIntegration from './components/AboutIntegration.svelte';
	import AboutMerchant from './components/AboutMerchant.svelte';
	import AboutPlus from './components/AboutPlus.svelte';
	import AboutTagger from './components/AboutTagger.svelte';
	import {
		areaError,
		areas,
		placesError,
		places,
		eventError,
		events,
		excludeLeader,
		userError,
		users
	} from '$lib/store';
	import { areasSync } from '$lib/sync/areas';
	import { eventsSync } from '$lib/sync/events';
	import { reportsSync } from '$lib/sync/reports';
	import { usersSync } from '$lib/sync/users';
	import { batchSync } from '$lib/sync/batchSync';
	import { resolve } from '$app/paths';
	import type { Area, Place } from '$lib/types';
	import { errToast, formatElementID } from '$lib/utils';
	import { onMount } from 'svelte';

	onMount(() => {
		batchSync([eventsSync, usersSync, areasSync, reportsSync]);
	});

	// alert for all errors
	$: {
		if ($placesError) errToast($placesError);
		if ($userError) errToast($userError);
		if ($eventError) errToast($eventError);
		if ($areaError) errToast($areaError);
	}

	let dataInitalized = false;

	let merchants: Place[] = [];
	let communities: Area[] = [];

	const fetchMerchantName = async (placeId: number): Promise<string> => {
		try {
			const response = await fetch(`https://api.btcmap.org/v4/places/${placeId}?fields=name`);
			if (!response.ok) throw new Error('API call failed');
			const data = await response.json();
			return data.name || formatElementID(`node:${placeId}`);
		} catch {
			return formatElementID(`node:${placeId}`);
		}
	};

	const initializeData = async () => {
		const boostedMerchants = $places
			.filter((place: Place) => place.boosted_until)
			.sort(
				(a: Place, b: Place) =>
					Date.parse(b.boosted_until || '0') - Date.parse(a.boosted_until || '0')
			)
			.slice(0, 6);

		// Fetch names for merchants
		const merchantPromises = boostedMerchants.map(async (merchant: Place) => {
			const name = await fetchMerchantName(merchant.id);
			return { ...merchant, name };
		});

		try {
			merchants = await Promise.all(merchantPromises);
		} catch (error) {
			console.error('Error fetching merchant names:', error);
			// Fallback: use merchants without names
			merchants = boostedMerchants;
		}

		populateLeaderboard();

		communities = $areas.filter((area) => featuredCommunities.includes(area.id));
	};

	// Initialize data when all stores are loaded
	$: if (
		$places?.length &&
		$users?.length &&
		$events?.length &&
		$areas?.length &&
		!dataInitalized
	) {
		initializeData();
		dataInitalized = true;
	}

	let supertaggers: { id: number; username: string; avatar: string; total: number }[] = [];

	const populateLeaderboard = () => {
		$users.forEach((user) => {
			if ($excludeLeader.includes(user.id)) {
				return;
			}

			let userEvents = $events.filter((event) => event['user_id'] == user.id);

			if (userEvents.length) {
				let id = user.id;
				let username = user['osm_json'].display_name;
				let avatar = user['osm_json'].img
					? user['osm_json'].img.href
					: '/images/satoshi-nakamoto.png';

				supertaggers.push({
					id,
					username,
					avatar,
					total: id === 17221642 ? userEvents.length + 120 : userEvents.length
				});
			}
		});

		supertaggers.sort((a, b) => b.total - a.total);
		supertaggers = supertaggers.slice(0, 6);
	};

	const featuredCommunities = [
		'bitcoin-island-philippines',
		'btc-curacao',
		'bitcoin-beach',
		'bitcoin-ekasi',
		'einundzwanzig-deutschland',
		'free-madeira'
	];

	const communityIntegrations = [
		{ name: 'Coinos', icon: 'coinos', url: 'https://coinos.io/' },
		{ name: 'Wallet of Satoshi', icon: 'wos', url: 'https://www.walletofsatoshi.com/' },
		{ name: 'Pouch', icon: 'pouch', url: 'https://pouch.ph/' },
		{ name: 'Bolt Card', icon: 'bolt', url: 'https://www.boltcard.org/' },
		{ name: 'Galoy', icon: 'galoy', url: 'https://galoy.io/' },
		{ name: 'Satimoto', icon: 'satimoto', url: 'https://satimoto.com/' },
		{
			name: 'Bitcoin Dashboard',
			icon: 'dashboard',
			url: 'https://bitcoin-primodata.streamlit.app/'
		},
		{ name: 'BitLocal', icon: 'bitlocal', url: 'https://www.bitlocal.app/' },
		{ name: 'Nostr Bot', icon: 'nostr-bot', url: 'https://github.com/BcnBitcoinOnly/btcmap-bot' },
		{ name: 'Fedi', icon: 'fedi', url: 'https://www.fedi.xyz/' },
		{ name: 'Osmo', icon: 'osmo', url: 'https://www.osmowallet.com/' },
		{ name: 'Bitcoin Rocks!', icon: 'bitcoin-rocks', url: 'https://bitcoin.rocks/' },
		{ name: 'lipa', icon: 'lipa', url: 'https://lipa.swiss/' },
		{ name: 'Spirit of Satoshi', icon: 'spirit', url: 'https://www.spiritofsatoshi.ai/' },
		{ name: 'Blockstream', icon: 'blockstream', url: 'https://blockstream.com/local/' },
		{ name: 'Satlantis', icon: 'satlantis', url: 'https://www.satlantis.io/' },
		{ name: 'Aqua Wallet', icon: 'aqua', url: 'https://aquawallet.io/' },
		{ name: 'Adopting Bitcoin', icon: 'adopting', url: 'https://www.adoptingbitcoin.org/' }
	];

	const projectIntegrations = [
		{ name: 'OpenStreetMap', icon: 'osm', url: 'https://www.openstreetmap.org/' },
		{ name: 'LNbits', icon: 'lnbits', url: 'https://lnbits.com/' },
		{ name: 'GitHub', icon: 'gh', url: 'https://github.com/' },
		{ name: 'Voltage', icon: 'voltage', url: 'https://voltage.cloud/' },
		{ name: 'Leaflet', icon: 'leaflet', url: 'https://leafletjs.com/' },
		{ name: 'Chart.js', icon: 'chartjs', url: 'https://www.chartjs.org/' }
	];

	const contributors = [
		{
			name: 'salvanakamoto',
			title: 'iOS Developer',
			url: 'https://github.com/salvatoto',
			file: 'jpg'
		},
		{
			name: 'saunter',
			title: 'Community Leader',
			url: 'https://twitter.com/StackingSaunter',
			file: 'jpg'
		},
		{
			name: 'Rogzy',
			title: 'Community Leader',
			url: 'https://twitter.com/DecouvreBitcoin',
			file: 'jpg'
		},
		{
			name: 'HolgerHatGarKeineNode',
			title: 'Community Coder',
			url: 'https://github.com/HolgerHatGarKeineNode',
			file: 'jpeg'
		},
		{
			name: '3j2009',
			title: 'Designer',
			url: 'https://github.com/3j2009',
			file: 'jpeg'
		},
		{
			name: 'Liam',
			title: 'Animator',
			url: 'https://twitter.com/LiamCyDennis',
			file: 'jpg'
		},
		{
			name: 'Andrej',
			title: 'Icon Designer',
			url: 'https://nostr.com/npub1cak3t8wa5zaxe99mfrzqzt8h2hp0lvalk8agj3qmthkmrs3zvlaqyt964v',
			file: 'png'
		}
	];

	const coreTeam = [
		{
			name: 'Igor',
			title: 'Backend & Android',
			avatar: 'igor',
			socials: [
				{ url: 'https://bubelov.com/', name: 'website' },
				{ url: 'https://github.com/bubelov', name: 'github' }
			]
		},
		{
			name: 'Nathan Day',
			title: 'Project Manager',
			avatar: 'nathan',
			socials: [
				{ url: 'https://twitter.com/nathan_day', name: 'x' },
				{ url: 'https://github.com/dadofsambonzuki', name: 'github' }
			]
		},
		{
			name: 'secondl1ght',
			title: 'Web Developer',
			avatar: 'secondl1ght',
			socials: [
				{ url: 'https://secondl1ght.site', name: 'website' },
				{ url: 'https://twitter.com/secondl1ght', name: 'x' },
				{ url: 'https://github.com/secondl1ght', name: 'github' }
			]
		},
		{
			name: 'Karnage',
			title: 'Lead Designer',
			avatar: 'karnage',
			socials: [
				{ url: 'https://twitter.com/KarnageBitcoin', name: 'x' },
				{ url: 'https://github.com/cogentgene', name: 'github' }
			]
		}
	];
</script>

<svelte:head>
	<title>BTC Map - About</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - About" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-20 text-primary md:space-y-40 dark:text-white">
	<div class="space-y-5 text-center text-xl">
		<h1 class="text-4xl !leading-tight font-semibold md:text-5xl">About Us</h1>
		<p class="mx-auto md:w-[600px]">
			BTC Map is a free and open source project powered by volunteer bitcoiners and bitcoin-friendly
			merchants around the world.
		</p>
	</div>

	<section class="w-full justify-center space-y-10 lg:flex lg:space-y-0 lg:space-x-10">
		<div class="lg:w-[475px]">
			<h2 class="mb-5 text-3xl font-semibold">Merchants</h2>

			<div class="space-y-5">
				<p>
					Merchants are at the heart of BTC Map. These businesses are front-running the paradigm
					change and positioning themselves for continued success. Any merchant who accepts bitcoin
					can be listed on BTC Map.
				</p>
				<p>
					<strong>Accept bitcoin?</strong>
					<a
						href={resolve('/add-location')}
						class="font-semibold text-link transition-colors hover:text-hover"
						>Get listed on BTC Map</a
					>!
				</p>
			</div>
		</div>

		<div class="flex grid-cols-3 flex-wrap justify-center gap-5 lg:grid">
			{#if merchants.length}
				{#each merchants as merchant (merchant.id)}
					<AboutMerchant id={merchant.id.toString()} icon={merchant.icon} tooltip={merchant.name} />
				{/each}
			{:else}
				{#each Array(6) as _, index (index)}
					<span class="h-24 w-24 animate-pulse rounded-full bg-link/50" />
				{/each}
			{/if}
		</div>
	</section>

	<section class="w-full space-y-10 rounded-xl bg-[#164E63] p-5 text-center text-white md:p-10">
		<h2 class="text-3xl font-semibold">Shadowy Supertaggers</h2>

		<p class="mx-auto lg:w-[650px]">
			Shadowy Supertaggers are people who power this project. They are volunteers who selflessly
			take the time to update business locations with new information. Without them, BTC Map would
			not be sustainable!
		</p>

		<div class="space-y-5">
			<p class="font-semibold uppercase">Our top supertaggers</p>

			<div class="flex flex-wrap justify-center gap-5">
				{#if supertaggers.length}
					{#each supertaggers.map((t) => ({ ...t, total: undefined })) as tagger (tagger.id)}
						<AboutTagger {tagger} />
					{/each}
				{:else}
					{#each Array(6) as _, index (index)}
						<span class="h-24 w-24 animate-pulse rounded-full bg-link/50" />
					{/each}
				{/if}
			</div>

			<a
				href={resolve('/leaderboard')}
				class="inline-block font-semibold underline underline-offset-4 hover:no-underline"
				>View leaderboard</a
			>
		</div>
	</section>

	<section class="w-full justify-center space-y-10 lg:flex lg:space-y-0 lg:space-x-10">
		<div class="lg:w-[475px]">
			<h2 class="mb-5 text-3xl font-semibold">Communities</h2>

			<div class="space-y-5">
				<p>Bitcoin communities help drive global adoption by onboarding new users locally!</p>
				<p>
					<strong>Don’t see your community?</strong>
					<a
						href={resolve('/communities/add')}
						class="font-semibold text-link transition-colors hover:text-hover">Add it to BTC Map</a
					>.
				</p>
			</div>
		</div>

		<div>
			<div class="flex grid-cols-3 flex-wrap justify-center gap-5 lg:grid">
				{#if communities.length}
					{#each communities as community (community.id)}
						<AboutCommunity {community} />
					{/each}
				{:else}
					{#each Array(6) as _, index (index)}
						<span class="h-24 w-24 animate-pulse rounded-full bg-link/50" />
					{/each}
				{/if}
			</div>

			<div class="mt-5 flex justify-center">
				<a
					href={resolve('/communities')}
					class="font-semibold text-link transition-colors hover:text-hover">See all communities</a
				>
			</div>
		</div>
	</section>

	<section
		class="w-full space-y-10 rounded-xl bg-[#F1F7FC] p-5 text-center md:p-10 dark:bg-white/[0.15]"
	>
		<h2 class="text-3xl font-semibold">Integrations</h2>

		<p class="font-semibold uppercase">
			Community integrations <span class="block text-sm font-normal normal-case"
				>Projects using BTC Map</span
			>
		</p>

		<div class="flex flex-wrap justify-center gap-10">
			{#each communityIntegrations as integration (integration.url)}
				<AboutIntegration {integration} />
			{/each}
			<AboutPlus />
		</div>

		<p class="font-semibold uppercase">
			Project integrations <span class="block text-sm font-normal normal-case"
				>BTC Map uses these projects</span
			>
		</p>

		<div class="flex flex-wrap justify-center gap-10">
			{#each projectIntegrations as integration (integration.url)}
				<AboutIntegration {integration} />
			{/each}
			<AboutPlus />
		</div>

		<p>
			If you are interested in integrating with us please <a
				href="mailto:hello@btcmap.org"
				class="font-semibold text-link transition-colors hover:text-hover">reach out</a
			>!
		</p>
	</section>

	<section class="w-full justify-center space-y-10 lg:flex lg:space-y-0 lg:space-x-10">
		<div class="lg:w-[475px]">
			<h2 class="mb-5 text-3xl font-semibold">Contributors</h2>

			<p>
				Anybody can contribute to BTC Map in many different ways. If you would like to get involved
				please don't hesitate and come join the fun!
			</p>
		</div>

		<div class="flex grid-cols-3 flex-wrap justify-center gap-5 lg:grid">
			{#each contributors as contributor (contributor.url)}
				<AboutContributor {contributor} />
			{/each}
		</div>
	</section>

	<section
		class="w-full justify-center space-y-10 rounded-xl bg-[#EBEFF2] p-5 md:p-10 lg:flex lg:space-y-0 lg:space-x-10 dark:bg-white/[0.15]"
	>
		<div class="lg:w-[475px]">
			<h2 class="mb-10 text-3xl font-semibold">Core Team</h2>

			<div class="space-y-10">
				<p>
					<strong>Igor</strong> is a long time bitcoiner, mapper, and digital nomad living abroad. He
					created BTC Map as an Android application and the project has since gained worldwide momentum
					from there. He now also maintains all of the backend infrastructure for the project.
				</p>
				<p>
					<strong>Nathan</strong> is a tech entrepreneur turned pleb-at-large. He brought the core team
					together to accelerate app development. Having built, sold, invested in and advised tech businesses
					over the years he is now focused on bitcoin, building BTCMap.org, gamertron.net and delivering
					bitcoin education for kids.
				</p>
				<p>
					A self-taught Web Developer, <strong>secondl1ght</strong> dove head first down the bitcoin rabbit
					hole and left his fiat career to focus on bitcoin development full-time. He created and maintains
					the BTC Map web application, as well as an encrypted messaging app called Cipherchat, and works
					on lightning network tools at Amboss Technologies.
				</p>
				<p>
					<strong>Karnage</strong> is the lead designer on the web app and created the BTC Map brand.
					He has contributed to many high profile bitcoin open source projects. His mission is to help
					startup founders succeed and creates products to achieve this goal. Pixel-perfect product design
					every time. Get it shipped.
				</p>
			</div>
		</div>

		<div class="flex grid-cols-2 flex-wrap items-center justify-center gap-10 lg:grid">
			{#each coreTeam as member (member.name)}
				<AboutCore {member} />
			{/each}
		</div>
	</section>
</main>
