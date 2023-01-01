<script>
	import axios from 'axios';
	import tippy from 'tippy.js';
	import {
		Header,
		Footer,
		PrimaryButton,
		CommunityLeaderboardItem,
		CommunityLeaderboardSkeleton,
		TopButton
	} from '$comp';
	import { errToast } from '$lib/utils';
	import { areas, areaError, reports, reportError, syncStatus } from '$lib/store';

	// alert for area errors
	$: $areaError && errToast($areaError);

	// alert for report errors
	$: $reportError && errToast($reportError);

	$: communities = $areas.filter((area) => area.tags.type === 'community');
	$: communityReports = $reports
		.filter((report) => report.area_id && report.area_id.length > 2)
		.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));
	let leaderboard;
	let loading;

	let upToDateTooltip;
	let upToDateTooltipMobile;
	let legacyTooltip;
	let legacyTooltipMobile;
	let gradeTooltip;
	let gradeTooltipMobile;

	const populateLeaderboard = (status, communities, communityReports) => {
		if (communities.length && communityReports.length && !status) {
			loading = true;
			leaderboard = [];
			let reports = communityReports.slice(0, communities.length);

			reports.forEach((report) => {
				let community = communities.find((community) => community.id === report.area_id);

				if (community && community.tags && community.tags['icon:square'] && community.tags.name) {
					report.icon = community.tags['icon:square'];
					report.name = community.tags.name;
					report.sponsor = community.tags.sponsor ? true : false;

					leaderboard.push(report);
				}
			});

			leaderboard.sort((a, b) =>
				b.tags.up_to_date_percent === a.tags.up_to_date_percent
					? b.tags.total_elements === a.tags.total_elements
						? a.tags.legacy_elements - b.tags.legacy_elements
						: b.tags.total_elements - a.tags.total_elements
					: b.tags.up_to_date_percent - a.tags.up_to_date_percent
			);

			leaderboard = leaderboard;
			loading = false;
		}
	};

	$: populateLeaderboard($syncStatus, communities, communityReports);

	const headings = ['Position', 'Name', 'Up-To-Date', 'Total Locations', 'Legacy', 'Grade'];

	const setTooltips = () => {
		tippy([upToDateTooltip, upToDateTooltipMobile], {
			content: `Locations that have been verified within one year.`,
			allowHTML: true
		});

		tippy([legacyTooltip, legacyTooltipMobile], {
			content: `Locations with a <em>payment:bitcoin</em> tag instead of the
			<em>currency:XBT</em> tag.`,
			allowHTML: true
		});

		tippy([gradeTooltip, gradeTooltipMobile], {
			content: `<table>
	<thead>
		<tr>
			<th class='mr-1 inline-block'>Up-To-Date</th>
			<th>Grade</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>95-100%</td>
			<td>5 Star</td>
		</tr>
		<tr>
			<td>75-95%</td>
			<td>4 Star</td>
		</tr>
		<tr>
			<td>50-75%</td>
			<td>3 Star</td>
		</tr>
		<tr>
			<td>25-50%</td>
			<td>2 Star</td>
		</tr>
		<tr>
			<td>0-25%</td>
			<td>1 Star</td>
		</tr>
	</tbody>
</table>`,
			allowHTML: true
		});
	};

	$: upToDateTooltip &&
		upToDateTooltipMobile &&
		legacyTooltip &&
		legacyTooltipMobile &&
		gradeTooltip &&
		gradeTooltipMobile &&
		setTooltips();
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
				style="w-[210px] mx-auto py-3 rounded-xl"
				link="/communities/add"
			/>

			<section id="leaderboard">
				<div class="hidden lg:grid text-center grid-cols-6 mb-5">
					{#each headings as heading}
						<h3 class="text-lg font-semibold text-primary">
							{heading}
							{#if heading === 'Up-To-Date'}
								<button bind:this={upToDateTooltip}>
									<i class="fa-solid fa-circle-info text-sm" />
								</button>
							{:else if heading === 'Legacy'}
								<button bind:this={legacyTooltip}>
									<i class="fa-solid fa-circle-info text-sm" />
								</button>
							{:else if heading === 'Grade'}
								<button bind:this={gradeTooltip}>
									<i class="fa-solid fa-circle-info text-sm" />
								</button>
							{/if}
						</h3>
					{/each}
				</div>
				<div class="lg:hidden text-center text-primary text-lg font-semibold mb-5 space-y-1">
					<h3>
						Up-To-Date <button bind:this={upToDateTooltipMobile}>
							<i class="fa-solid fa-circle-info" />
						</button>
					</h3>
					<h3>
						Legacy <button bind:this={legacyTooltipMobile}>
							<i class="fa-solid fa-circle-info" />
						</button>
					</h3>
					<h3>
						Grade <button bind:this={gradeTooltipMobile}>
							<i class="fa-solid fa-circle-info" />
						</button>
					</h3>
				</div>

				<div>
					{#if leaderboard && leaderboard.length && !loading}
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

<style>
	@import 'tippy.js/dist/tippy.css';
</style>
