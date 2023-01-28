<script>
	import {
		Header,
		Footer,
		AboutMerchant,
		AboutTagger,
		AboutCommunity,
		AboutIntegration,
		AboutPlus,
		AboutContributor,
		AboutCore
	} from '$comp';
	import {
		elements,
		elementError,
		users,
		userError,
		events,
		eventError,
		areas,
		areaError,
		excludeLeader
	} from '$lib/store';
	import { errToast } from '$lib/utils';
	import { latCalc, longCalc } from '$lib/map/setup';

	// alert for element errors
	$: $elementError && errToast($elementError);
	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for area errors
	$: $areaError && errToast($areaError);

	let merchants = $elements
		.filter((element) => element.tags['boost:expires'])
		.sort((a, b) => Date.parse(b.tags['boost:expires']) - Date.parse(a.tags['boost:expires']))
		.slice(0, 6);

	merchants.forEach((merchant) => {
		merchant.lat = latCalc(merchant['osm_json']);
		merchant.long = longCalc(merchant['osm_json']);
	});

	let supertaggers = [];

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
					total: id == '17221642' ? userEvents.length + 120 : userEvents.length
				});
			}
		});

		supertaggers.sort((a, b) => b.total - a.total);
		supertaggers = supertaggers.slice(0, 6);
	};

	populateLeaderboard();

	const featuredCommunities = [
		'bitcoin-island-philippines',
		'btc-curacao',
		'bitcoin-beach',
		'bitcoin-ekasi',
		'einundzwanzig-deutschland',
		'free-madeira'
	];

	const communities = $areas.filter((area) => featuredCommunities.includes(area.id));

	const communityIntegrations = [
		{ name: 'Coinos', icon: 'coinos', url: 'https://coinos.io/' },
		{ name: 'Wallet of Satoshi', icon: 'wos', url: 'https://www.walletofsatoshi.com/' },
		{ name: 'Pouch', icon: 'pouch', url: 'https://pouch.ph/' },
		{ name: 'Bolt Card', icon: 'bolt', url: 'https://www.boltcard.org/' },
		{ name: 'Galoy', icon: 'galoy', url: 'https://galoy.io/' }
	];

	const projectIntegrations = [
		{ name: 'OpenStreetMap', icon: 'osm', url: 'https://www.openstreetmap.org/' },
		{ name: 'LNbits', icon: 'lnbits', url: 'https://lnbits.com/' },
		{ name: 'GitHub', icon: 'gh', url: 'https://github.com/' },
		{ name: 'Voltage', icon: 'voltage', url: 'https://voltage.cloud/' },
		{ name: 'Leaflet', icon: 'leaflet', url: 'https://leafletjs.com/' }
	];

	const contributors = [
		{ name: 'salvanakamoto', title: 'iOS Developer', url: 'https://github.com/salvatoto' },
		{ name: 'saunter', title: 'Community Leader', url: 'https://twitter.com/StackingSaunter' },
		{ name: 'Rogzy', title: 'Community Leader', url: 'https://twitter.com/DecouvreBitcoin' }
	];

	const coreTeam = [
		{
			name: 'Nathan Day',
			title: 'Project Manager',
			avatar: 'nathan',
			socials: [
				{ url: 'https://twitter.com/nathan_day', name: 'twitter' },
				{ url: 'https://github.com/dadofsambonzuki', name: 'github' }
			]
		},
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
			name: 'secondl1ght',
			title: 'Web Developer',
			avatar: 'secondl1ght',
			socials: [
				{ url: 'https://secondl1ght.site', name: 'website' },
				{ url: 'https://twitter.com/secondl1ght', name: 'twitter' },
				{ url: 'https://github.com/secondl1ght', name: 'github' }
			]
		},
		{
			name: 'Karnage',
			title: 'Lead Designer',
			avatar: 'karnage',
			socials: [
				{ url: 'https://twitter.com/KarnageBitcoin', name: 'twitter' },
				{ url: 'https://github.com/cogentgene', name: 'github' }
			]
		}
	];
</script>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-20 md:space-y-40 mt-10 mb-20 text-primary">
			<div class="text-xl text-center space-y-5">
				<h1 class="text-4xl md:text-5xl font-semibold !leading-tight">About Us</h1>
				<p class="md:w-[600px] mx-auto">
					BTC Map is a free and open source project powered by volunteer bitcoiners and
					bitcoin-friendly merchants around the world.
				</p>
			</div>

			<section class="w-full lg:flex justify-center space-y-10 lg:space-y-0 lg:space-x-10">
				<div class="lg:w-[475px]">
					<h2 class="mb-5 font-semibold text-3xl">Merchants</h2>

					<div class="space-y-5">
						<p>
							Merchants are at the heart of BTC Map. These businesses are front-running the paradigm
							change and positioning themselves for continued success. Any merchant who accepts
							bitcoin can be listed on BTC Map.
						</p>
						<p>
							<strong>Accept bitcoin?</strong>
							<a
								href="/add-location"
								class="text-link font-semibold hover:text-hover transition-colors"
								>Get listed on BTC Map</a
							>!
						</p>
					</div>
				</div>

				<div class="flex flex-wrap justify-center lg:grid grid-cols-3 gap-5">
					{#if merchants.length}
						{#each merchants as merchant}
							<AboutMerchant
								lat={merchant.lat}
								long={merchant.long}
								icon={merchant.tags['icon:android']}
								tooltip={merchant['osm_json'].tags.name}
							/>
						{/each}
					{:else}
						{#each Array(6) as skeleton}
							<span class="w-24 h-24 rounded-full bg-link/50 animate-pulse" />
						{/each}
					{/if}
				</div>
			</section>

			<section class="bg-[#164E63] p-5 md:p-10 rounded-xl w-full space-y-10 text-center text-white">
				<h2 class="font-semibold text-3xl">Shadowy Supertaggers</h2>

				<p class="lg:w-[650px] mx-auto">
					Shadowy Supertaggers are people who power this project. They are volunteers who selflessly
					take the time to update business locations with new information. Without them, BTC Map
					would not be sustainable!
				</p>

				<div class="space-y-5">
					<p class="uppercase font-semibold">Our top supertaggers</p>

					<div class="flex flex-wrap justify-center gap-5">
						{#if supertaggers.length}
							{#each supertaggers as tagger}
								<AboutTagger {tagger} />
							{/each}
						{:else}
							{#each Array(6) as skeleton}
								<span class="w-24 h-24 rounded-full bg-link/50 animate-pulse" />
							{/each}
						{/if}
					</div>

					<a
						href="/leaderboard"
						class="font-semibold inline-block underline hover:no-underline underline-offset-4"
						>View leaderboard</a
					>
				</div>
			</section>

			<section class="w-full lg:flex justify-center space-y-10 lg:space-y-0 lg:space-x-10">
				<div class="lg:w-[475px]">
					<h2 class="mb-5 font-semibold text-3xl">Communities</h2>

					<div class="space-y-5">
						<p>
							Bitcoin mapping communities maintain their local datasets and strive to have the most
							accurate information. They also help onboard new merchants in their area!
						</p>
						<p>
							<strong>Don’t see your community?</strong>
							<a
								href="/communities/add"
								class="text-link font-semibold hover:text-hover transition-colors"
								>Add it to BTC Map</a
							>.
						</p>
					</div>
				</div>

				<div>
					<div class="flex flex-wrap justify-center lg:grid grid-cols-3 gap-5">
						{#if communities.length}
							{#each communities as community}
								<AboutCommunity {community} />
							{/each}
						{:else}
							{#each Array(6) as skeleton}
								<span class="w-24 h-24 rounded-full bg-link/50 animate-pulse" />
							{/each}
						{/if}
					</div>

					<div class="flex justify-center mt-5">
						<a
							href="/communities"
							class="text-link font-semibold hover:text-hover transition-colors"
							>See all communities</a
						>
					</div>
				</div>
			</section>

			<section class="bg-[#F1F7FC] p-5 md:p-10 rounded-xl w-full space-y-10 text-center">
				<h2 class="font-semibold text-3xl">Integrations</h2>

				<p class="font-semibold uppercase">
					Community integrations <span class="text-sm font-normal block normal-case"
						>Projects using BTC Map</span
					>
				</p>

				<div class="flex flex-wrap justify-center gap-10">
					{#each communityIntegrations as integration}
						<AboutIntegration {integration} />
					{/each}
					<AboutPlus />
				</div>

				<p class="font-semibold uppercase">
					Project integrations <span class="text-sm font-normal block normal-case"
						>BTC Map uses these projects</span
					>
				</p>

				<div class="flex flex-wrap justify-center gap-10">
					{#each projectIntegrations as integration}
						<AboutIntegration {integration} />
					{/each}
					<AboutPlus />
				</div>

				<p>
					If you are interested in integrating with us please <a
						href="mailto:hello@btcmap.org"
						class="text-link font-semibold hover:text-hover transition-colors">reach out</a
					>!
				</p>
			</section>

			<section class="w-full lg:flex justify-center space-y-10 lg:space-y-0 lg:space-x-10">
				<div class="lg:w-[475px]">
					<h2 class="mb-5 font-semibold text-3xl">Contributors</h2>

					<p>
						Anybody can contribute to BTC Map in many different ways. If you would like to get
						involved please don't hesitate and come join the fun!
					</p>
				</div>

				<div class="flex flex-wrap justify-center lg:grid grid-cols-3 gap-5">
					{#each contributors as contributor}
						<AboutContributor {contributor} />
					{/each}
				</div>
			</section>

			<section
				class="bg-[#EBEFF2] p-5 md:p-10 rounded-xl w-full lg:flex justify-center space-y-10 lg:space-y-0 lg:space-x-10"
			>
				<div class="lg:w-[475px]">
					<h2 class="mb-10 font-semibold text-3xl">Core Team</h2>

					<div class="space-y-10">
						<p>
							<strong>Nathan</strong> is a tech entrepreneur turned pleb-at-large. Having built, sold,
							invested in and advised tech businesses over the years he is now focused on bitcoin, building
							BTCMap.org, gamertron.net and delivering bitcoin education for kids.
						</p>
						<p>
							<strong>Igor</strong> is a long time bitcoiner, mapper, and digital nomad living abroad.
							He created BTC Map as an Android application and the project has since gained worldwide
							momentum from there. He now also maintains all of the backend infrastructure for the project.
						</p>
						<p>
							A self-taught Web Developer, <strong>secondl1ght</strong> dove head first down the bitcoin
							rabbit hole and left his fiat career to focus on bitcoin development full-time. He contributes
							to open source projects, is a privacy advocate, and freedom lover.
						</p>
						<p>
							<strong>Karnage</strong> is the lead designer on the web app and created the BTC Map brand.
							He has contributed to many high profile bitcoin open source projects. His mission is to
							help startup founders succeed and creates products to achieve this goal. Pixel-perfect
							product design every time. Get it shipped.
						</p>
					</div>
				</div>

				<div class="flex flex-wrap justify-center items-center lg:grid grid-cols-2 gap-10">
					{#each coreTeam as member}
						<AboutCore {member} />
					{/each}
				</div>
			</section>
		</main>
		<Footer />
	</div>
</div>
