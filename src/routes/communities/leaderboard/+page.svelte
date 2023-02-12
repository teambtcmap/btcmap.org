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

	$: communities =
		$reports &&
		$reports.length &&
		$areas.filter(
			(area) =>
				area.tags.type === 'community' &&
				((area.tags['box:east'] &&
					area.tags['box:north'] &&
					area.tags['box:south'] &&
					area.tags['box:west']) ||
					area.tags.geo_json) &&
				area.tags.name &&
				area.tags['icon:square'] &&
				area.tags.continent &&
				Object.keys(area.tags).find((key) => key.includes('contact')) &&
				$reports.find((report) => report.area_id === area.id)
		);
	$: communityReports =
		communities &&
		communities.length &&
		$reports
			.filter((report) => communities.find((community) => community.id === report.area_id))
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

			communities.forEach((community) => {
				let communityReport = communityReports.find((report) => report.area_id === community.id);

				if (communityReport) {
					community.report = communityReport;

					leaderboard.push(community);
				}
			});

			leaderboard.sort((a, b) =>
				b.report.tags.up_to_date_percent === a.report.tags.up_to_date_percent
					? b.report.tags.total_elements === a.report.tags.total_elements
						? a.report.tags.legacy_elements - b.report.tags.legacy_elements
						: b.report.tags.total_elements - a.report.tags.total_elements
					: b.report.tags.up_to_date_percent - a.report.tags.up_to_date_percent
			);

			leaderboard = leaderboard.slice(0, 50);
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
	<meta property="og:image" content="https://btcmap.org/images/og/top-communities.png" />
	<meta property="twitter:title" content="BTC Map - Communities Leaderboard" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/top-communities.png" />
</svelte:head>

<div class="bg-teal">
	<Header />

	<main class="mt-10 mb-20">
		<div class="mx-auto w-10/12 space-y-10 xl:w-[1200px]">
			<h1
				class="gradient text-center text-4xl font-semibold !leading-tight text-primary md:text-5xl"
			>
				Top Communities
			</h1>

			<h2 class="mx-auto w-full text-center text-xl font-semibold text-primary lg:w-[800px]">
				Bitcoin mapping communities maintain their local datasets and strive to have the most
				accurate information. They also help onboard new merchants in their area!
			</h2>

			<div class="items-center justify-center space-y-5 md:flex md:space-y-0 md:space-x-5">
				<PrimaryButton
					text="Add community"
					style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
					link="/communities/add"
				/>
				<PrimaryButton
					text="View community map"
					style="md:w-[200px] mx-auto md:mx-0 py-3 rounded-xl"
					link="/map?communitiesOnly"
				/>
			</div>

			<section id="leaderboard">
				<div class="mb-5 hidden grid-cols-6 text-center lg:grid">
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
				<div class="mb-5 space-y-1 text-center text-lg font-semibold text-primary lg:hidden">
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
								avatar={item.tags['icon:square']}
								name={item.tags.name}
								org={item.tags.organization}
								sponsor={item.tags.sponsor}
								id={item.id}
								upToDate={item.report.tags.up_to_date_percent}
								total={item.report.tags.total_elements}
								legacy={item.report.tags.legacy_elements}
								grade={item.report.tags.grade}
							/>
						{/each}
					{:else}
						{#each Array(50) as skeleton}
							<CommunityLeaderboardSkeleton />
						{/each}
					{/if}
				</div>

				<p class="text-center text-sm text-body">
					*Data sorted by Up-To-Date, then Total Locations, then Legacy.
				</p>

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
