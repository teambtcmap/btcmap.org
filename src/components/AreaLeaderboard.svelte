<script lang="ts">
	import { run } from 'svelte/legacy';

	import { AreaLeaderboardItem, AreaLeaderboardSkeleton, GradeTable, TopButton } from '$lib/comp';
	import { areaError, areas, reportError, reports, syncStatus } from '$lib/store';
	import type { Area, AreaType, LeaderboardArea, Report } from '$lib/types';
	import { errToast, getGrade, validateContinents } from '$lib/utils';
	import tippy from 'tippy.js';

	interface Props {
		type: AreaType;
	}

	let { type }: Props = $props();

	// alert for area errors
	run(() => {
		$areaError && errToast($areaError);
	});

	// alert for report errors
	run(() => {
		$reportError && errToast($reportError);
	});

	let areasFiltered =
		$derived($reports && $reports.length
			? $areas.filter((area) => {
					if (type === 'community') {
						return (
							area.tags.type === 'community' &&
							area.tags.geo_json &&
							area.tags.name &&
							area.tags['icon:square'] &&
							area.tags.continent &&
							Object.keys(area.tags).find((key) => key.includes('contact')) &&
							$reports.find((report) => report.area_id === area.id)
						);
					} else {
						return (
							area.tags.type === 'country' &&
							area.id.length === 2 &&
							area.tags.geo_json &&
							area.tags.name &&
							area.tags.continent &&
							validateContinents(area.tags.continent)
						);
					}
				})
			: []);
	let areaReports =
		$derived(areasFiltered && areasFiltered.length
			? $reports
					.filter((report) => areasFiltered.find((area) => area.id === report.area_id))
					.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']))
			: []);
	let leaderboard: LeaderboardArea[] = $state();
	let loading: boolean = $state();

	let upToDateTooltip: HTMLButtonElement = $state();
	let upToDateTooltipMobile: HTMLButtonElement = $state();
	let gradeTooltip: HTMLButtonElement = $state();
	let gradeTooltipMobile: HTMLButtonElement = $state();

	const score = (report: Report): number => {
		return Math.max(report.tags.total_elements - report.tags.outdated_elements * 5, 0);
	};

	const populateLeaderboard = (status: boolean, areasFiltered: Area[], areasReports: Report[]) => {
		if (areasFiltered.length && areasReports.length && !status) {
			loading = true;
			leaderboard = [];

			areasFiltered.forEach((area) => {
				let areaReport = areasReports.find((report) => report.area_id === area.id);

				if (areaReport) {
					const grade = getGrade(areaReport.tags.up_to_date_percent);

					leaderboard.push({ ...area, report: areaReport, grade });
				}
			});

			leaderboard.sort((a, b) => {
				const aScore = score(a.report);
				const bScore = score(b.report);

				if (bScore === aScore) {
					return b.report.tags.total_elements - a.report.tags.total_elements;
				} else {
					return bScore - aScore;
				}
			});

			leaderboard = leaderboard;
			loading = false;
		}
	};

	run(() => {
		populateLeaderboard($syncStatus, areasFiltered, areaReports);
	});

	let leaderboardCount = $state(50);
	let leaderboardPaginated =
		$derived(leaderboard && leaderboard.length && !loading ? leaderboard.slice(0, leaderboardCount) : []);

	const headings = ['Position', 'Name', 'Up-To-Date', 'Total Locations', 'Grade'];

	const setTooltips = () => {
		tippy([upToDateTooltip, upToDateTooltipMobile], {
			content: `Locations that have been verified within one year.`,
			allowHTML: true
		});

		tippy([gradeTooltip, gradeTooltipMobile], {
			content: GradeTable,
			allowHTML: true
		});
	};

	run(() => {
		upToDateTooltip &&
			upToDateTooltipMobile &&
			gradeTooltip &&
			gradeTooltipMobile &&
			setTooltips();
	});
</script>

<section id="leaderboard" class="dark:lg:rounded dark:lg:bg-white/10 dark:lg:py-8">
	<div class="mb-5 hidden grid-cols-5 text-center lg:grid">
		{#each headings as heading}
			<h3 class="text-lg font-semibold text-primary dark:text-white">
				{heading}
				{#if heading === 'Up-To-Date'}
					<button bind:this={upToDateTooltip}>
						<i class="fa-solid fa-circle-info text-sm"></i>
					</button>
				{:else if heading === 'Grade'}
					<button bind:this={gradeTooltip}>
						<i class="fa-solid fa-circle-info text-sm"></i>
					</button>
				{/if}
			</h3>
		{/each}
	</div>
	<div
		class="mb-5 space-y-1 text-center text-lg font-semibold text-primary dark:text-white lg:hidden"
	>
		<h3>
			Up-To-Date <button bind:this={upToDateTooltipMobile}>
				<i class="fa-solid fa-circle-info"></i>
			</button>
		</h3>
		<h3>
			Grade <button bind:this={gradeTooltipMobile}>
				<i class="fa-solid fa-circle-info"></i>
			</button>
		</h3>
	</div>

	<div>
		{#if leaderboard && leaderboard.length && !loading}
			{#each leaderboardPaginated as item, index}
				<AreaLeaderboardItem
					{type}
					position={index + 1}
					avatar={type === 'community'
						? item.tags['icon:square']
						: `https://static.btcmap.org/images/countries/${item.id}.svg`}
					name={item.tags.name}
					sponsor={item.tags.sponsor ? true : false}
					id={item.id}
					upToDate={item.report.tags.up_to_date_percent}
					total={item.report.tags.total_elements}
					grade={item.grade}
				/>
			{/each}

			{#if leaderboardPaginated.length !== leaderboard.length}
				<button
					class="!my-5 mx-auto block text-xl font-semibold text-link transition-colors hover:text-hover"
					onclick={() => (leaderboardCount = leaderboardCount + 50)}>Load More</button
				>
			{/if}
		{:else}
			<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
			{#each Array(50) as skeleton}
				<AreaLeaderboardSkeleton />
			{/each}
		{/if}
	</div>

	<p class="text-center text-sm text-body dark:text-white">
		*Data is weighted by Up-To-Date locations and then sorted by Total Locations.
		<br />
		*Leaderboard updated once every 24 hours.
	</p>

	<div class="mt-10 flex justify-center">
		<TopButton />
	</div>
</section>
