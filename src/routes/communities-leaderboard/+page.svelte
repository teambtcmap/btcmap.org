<script>
	import axios from 'axios';
	import { onMount } from 'svelte';
	import {
		Header,
		Footer,
		PrimaryButton,
		CommunityLeaderboardItem,
		CommunityLeaderboardSkeleton,
		TopButton
	} from '$comp';
	import { errToast } from '$lib/utils';

	let reports = [];
	let communities = [];
	let leaderboard = [];

	const populateLeaderboard = async () => {
		const getReports = axios
			.get('https://api.btcmap.org/v2/reports')
			.then(function (response) {
				// handle success
				reports = response.data
					.filter((report) => report.area_id && report.area_id.length > 2)
					.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));
			})
			.catch(function (error) {
				// handle error
				errToast('Could not fetch reports, please try again or contact BTC Map.');
				console.log(error);
			});

		const getCommunities = axios
			.get('https://api.btcmap.org/v2/areas')
			.then(function (response) {
				// handle success
				communities = response.data.filter((area) => area.tags.type === 'community');
			})
			.catch(function (error) {
				// handle error
				errToast('Could not fetch communities, please try again or contact BTC Map.');
				console.log(error);
			});

		await Promise.allSettled([getReports, getCommunities]).then((results) =>
			results.forEach((result) => console.log(result.status))
		);

		if (reports && reports.length && communities && communities.length) {
			reports = reports.slice(0, communities.length);

			reports.forEach((report) => {
				let community = communities.find((community) => community.id === report.area_id);

				report.icon = community.tags['icon:square'];
				report.name = community.tags.name;
				report.sponsor = community.tags.sponsor ? true : false;

				leaderboard.push(report);
			});

			leaderboard.sort((a, b) =>
				b.tags.grade === a.tags.grade
					? b.tags.up_to_date_percent - a.tags.up_to_date_percent
					: b.tags.grade - a.tags.grade
			);

			leaderboard = leaderboard;
		}
	};

	onMount(() => populateLeaderboard());

	const headings = [
		'Position',
		'Name',
		'Up-To-Date',
		'Total Locations',
		'Legacy Locations',
		'Grade'
	];
</script>

<svelte:head>
	<title>BTC Map - Communities Leaderboard</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="BTC Map - Communities Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />
</svelte:head>

<div class="bg-teal">
	<Header />

	<main class="mt-10 mb-20">
		<div class="w-10/12 xl:w-[1200px] mx-auto space-y-10">
			<h1
				class="text-center text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Top Communities
			</h1>

			<h2 class="text-center text-primary text-xl font-semibold w-full lg:w-[800px] mx-auto">
				Bitcoin mapping communities maintain their local datasets and strive to have the most
				accurate information. They also help onboard new merchants in their area!
			</h2>

			<PrimaryButton
				text="Add a local community"
				style="w-[200px] mx-auto py-3 rounded-xl"
				link="/communities/add"
			/>

			<section id="leaderboard">
				<div class="hidden lg:grid text-center grid-cols-6 mb-5">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary">
							{heading}
						</h3>
					{/each}
				</div>

				<div>
					{#if leaderboard && leaderboard.length}
						{#each leaderboard as item, index}
							<CommunityLeaderboardItem
								position={index + 1}
								avatar={item.icon}
								name={item.name}
								sponsor={item.sponsor}
								id={item.area_id}
								upToDate={item.tags.up_to_date_percent}
								total={item.tags.total_elements}
								legacy={item.tags.legacy_elements}
								grade={item.tags.grade}
							/>
						{/each}
					{:else}
						{#each Array(50) as skeleton}
							<CommunityLeaderboardSkeleton />
						{/each}
					{/if}
				</div>

				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>

			<Footer />
		</div>
	</main>
</div>
