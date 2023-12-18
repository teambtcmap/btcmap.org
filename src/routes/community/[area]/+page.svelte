<script lang="ts">
	export let data;

	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Footer,
		Header,
		InfoTooltip,
		LatestTagger,
		MapLoadingEmbed,
		OpenTicket,
		OrgBadge,
		ProfileStat,
		Socials,
		SponsorBadge,
		TaggerSkeleton,
		Tip,
		TopButton
	} from '$lib/comp';
	import {
		attribution,
		calcVerifiedDate,
		changeDefaultIcons,
		generateIcon,
		generateMarker,
		geolocate,
		latCalc,
		layers,
		longCalc,
		toggleMapButtons,
		verifiedArr
	} from '$lib/map/setup';
	import {
		areaError,
		areas,
		elementError,
		elements,
		eventError,
		events,
		reportError,
		reports,
		theme,
		userError,
		users
	} from '$lib/store';
	import {
		TipType,
		type ActivityEvent,
		type BaseMaps,
		type Continents,
		type DomEventType,
		type Event,
		type Grade,
		type Leaflet,
		type User
	} from '$lib/types.js';
	import { detectTheme, errToast, updateChartThemes } from '$lib/utils';
	// @ts-expect-error
	import rewind from '@mapbox/geojson-rewind';
	import Chart from 'chart.js/auto';
	import { geoContains } from 'd3-geo';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import tippy from 'tippy.js';

	// alert for user errors
	$: $userError && errToast($userError);
	// alert for event errors
	$: $eventError && errToast($eventError);
	// alert for element errors
	$: $elementError && errToast($elementError);
	// alert for area errors
	$: $areaError && errToast($areaError);
	// alert for report errors
	$: $reportError && errToast($reportError);

	let initialRenderComplete = false;
	let dataInitialized = false;

	const initializeData = () => {
		if (dataInitialized) return;

		const communityFound = $areas.find(
			(area) =>
				area.id == data.id &&
				area.tags.type === 'community' &&
				((area.tags['box:east'] &&
					area.tags['box:north'] &&
					area.tags['box:south'] &&
					area.tags['box:west']) ||
					area.tags.geo_json) &&
				area.tags.name &&
				area.tags['icon:square'] &&
				area.tags.continent &&
				Object.keys(area.tags).find((key) => key.includes('contact'))
		);

		if (!communityFound) {
			console.log('Could not find community, please try again or contact BTC Map.');
			goto('/404');
			return;
		}

		const communityReports = $reports
			.filter((report) => report.area_id === data.id)
			.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

		if (!communityReports.length) {
			console.log(
				'Could not find any community reports, please try again tomorrow or contact BTC Map.'
			);
			goto('/404');
			return;
		}

		const community = communityFound.tags;

		avatar = community['icon:square'];
		org = community.organization;
		sponsor = community.sponsor;
		continent = community.continent;
		website = community['contact:website'];
		email = community['contact:email'];
		nostr = community['contact:nostr'];
		twitter = community['contact:twitter'];
		secondTwitter = community['contact:second_twitter'];
		meetup = community['contact:meetup'];
		eventbrite = community['contact:eventbrite'];
		telegram = community['contact:telegram'];
		discord = community['contact:discord'];
		youtube = community['contact:youtube'];
		github = community['contact:github'];
		reddit = community['contact:reddit'];
		instagram = community['contact:instagram'];
		whatsapp = community['contact:whatsapp'];
		facebook = community['contact:facebook'];
		linkedin = community['contact:linkedin'];
		rss = community['contact:rss'];
		signal = community['contact:signal'];

		if (community['tips:lightning_address']) {
			lightning = {
				destination: community['tips:lightning_address'],
				type: TipType.Address
			};
		} else if (community['tips:url']) {
			lightning = { destination: community['tips:url'], type: TipType.Url };
		}

		const latestReport = communityReports[0].tags;
		total = latestReport.total_elements;
		upToDate = latestReport.up_to_date_elements;
		outdated = latestReport.outdated_elements;
		legacy = latestReport.legacy_elements;
		grade = latestReport.grade;

		upToDatePercent = new Intl.NumberFormat('en-US').format(
			Number((upToDate / (total / 100)).toFixed(0))
		);

		outdatedPercent = new Intl.NumberFormat('en-US').format(
			Number((outdated / (total / 100)).toFixed(0))
		);

		legacyPercent = new Intl.NumberFormat('en-US').format(
			Number((legacy / (total / 100)).toFixed(0))
		);

		const rewoundPoly = rewind(community.geo_json, true);

		// filter elements within community
		const filteredElements = $elements.filter((element) => {
			let lat = latCalc(element['osm_json']);
			let long = longCalc(element['osm_json']);

			if (community.geo_json) {
				if (geoContains(rewoundPoly, [long, lat])) {
					return true;
				} else {
					return false;
				}
			} else if (
				lat >= Number(community['box:south']) &&
				lat <= Number(community['box:north']) &&
				long >= Number(community['box:west']) &&
				long <= Number(community['box:east'])
			) {
				return true;
			} else {
				return false;
			}
		});

		const communityEvents = $events.filter((event) =>
			filteredElements.find((element) => element.id === event.element_id)
		);

		communityEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

		const findUser = (tagger: Event) => {
			let foundUser = $users.find((user) => user.id == tagger['user_id']);

			if (foundUser) {
				if (!taggers.find((tagger) => tagger.id === foundUser?.id)) {
					taggers.push(foundUser);
				}

				return foundUser;
			} else {
				return undefined;
			}
		};

		communityEvents.forEach((event) => {
			let elementMatch = filteredElements.find((element) => element.id === event['element_id']);

			if (elementMatch) {
				let location = elementMatch['osm_json'].tags?.name || undefined;

				let tagger = findUser(event);

				eventElements.push({
					...event,
					location: location || 'Unnamed element',
					merchantId: elementMatch.id,
					tagger
				});
			}
		});

		eventElements = eventElements;
		taggers = taggers;

		const populateCharts = () => {
			const chartsReports = [...communityReports].sort(
				(a, b) => Date.parse(a['created_at']) - Date.parse(b['created_at'])
			);

			const today = new Date();
			const latestReport = chartsReports[chartsReports.length - 1];
			const latestReportDate = new Date(latestReport.created_at);
			const reportIsCurrent =
				today.getDate() === latestReportDate.getDate() &&
				today.getMonth() === latestReportDate.getMonth() &&
				today.getFullYear() === latestReportDate.getFullYear();

			if (!reportIsCurrent) {
				chartsReports.push({
					...latestReport,
					id: latestReport.id + 1,
					date: `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`,
					created_at: today.toISOString(),
					updated_at: today.toISOString()
				});
			}

			const theme = detectTheme();

			updatedChart = new Chart(updatedChartCanvas, {
				type: 'pie',
				data: {
					labels: ['Up-To-Date', 'Outdated'],
					datasets: [
						{
							label: 'Locations',
							data: [upToDate, outdated],
							backgroundColor: ['rgb(16, 183, 145)', 'rgb(235, 87, 87)'],
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

			let percents = chartsReports.filter((report) => report.tags.up_to_date_percent);

			upToDateChart = new Chart(upToDateChartCanvas, {
				type: 'line',
				data: {
					labels: percents.map(({ date }) => date),
					datasets: [
						{
							label: 'Up-To-Date Percent',
							data: percents.map(({ tags: { up_to_date_percent } }) => up_to_date_percent),
							fill: {
								target: 'origin',
								above: 'rgba(11, 144, 114, 0.2)'
							},
							borderColor: 'rgb(11, 144, 114)',
							tension: 0.1,
							pointStyle: false
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
					},
					scales: {
						x: {
							ticks: {
								maxTicksLimit: 5,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						},
						y: {
							min: 0,
							max: 100,
							ticks: {
								precision: 0,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						}
					},
					interaction: {
						intersect: false
					}
				}
			});

			totalChart = new Chart(totalChartCanvas, {
				type: 'line',
				data: {
					labels: chartsReports.map(({ date }) => date),
					datasets: [
						{
							label: 'Total Locations',
							data: chartsReports.map(({ tags: { total_elements } }) => total_elements),
							fill: {
								target: 'origin',
								above: 'rgba(0, 153, 175, 0.2)'
							},
							borderColor: 'rgb(0, 153, 175)',
							tension: 0.1,
							pointStyle: false
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
					},
					scales: {
						x: {
							ticks: {
								maxTicksLimit: 5,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						},
						y: {
							min: 0,
							grace: '5%',
							ticks: {
								precision: 0,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						}
					},
					interaction: {
						intersect: false
					}
				}
			});

			legacyChart = new Chart(legacyChartCanvas, {
				type: 'line',
				data: {
					labels: chartsReports.map(({ date }) => date),
					datasets: [
						{
							label: 'Legacy Locations',
							data: chartsReports.map(({ tags: { legacy_elements } }) => legacy_elements),
							fill: {
								target: 'origin',
								above: 'rgba(235, 87, 87, 0.2)'
							},
							borderColor: 'rgb(235, 87, 87)',
							tension: 0.1,
							pointStyle: false
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
					},
					scales: {
						x: {
							ticks: {
								maxTicksLimit: 5,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						},
						y: {
							min: 0,
							grace: '5%',
							ticks: {
								precision: 0,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						}
					},
					interaction: {
						intersect: false
					}
				}
			});

			paymentMethodChart = new Chart(paymentMethodChartCanvas, {
				type: 'line',
				data: {
					labels: chartsReports.map(({ date }) => date),
					datasets: [
						{
							label: 'On-chain',
							data: chartsReports.map(
								({ tags: { total_elements_onchain } }) => total_elements_onchain
							),
							fill: false,
							borderColor: 'rgb(247, 147, 26)',
							tension: 0.1,
							pointStyle: false
						},
						{
							label: 'Lightning',
							data: chartsReports.map(
								({ tags: { total_elements_lightning } }) => total_elements_lightning
							),
							fill: false,
							borderColor: 'rgb(249, 193, 50)',
							tension: 0.1,
							pointStyle: false
						},
						{
							label: 'Contactless',
							data: chartsReports.map(
								({ tags: { total_elements_lightning_contactless } }) =>
									total_elements_lightning_contactless
							),
							fill: false,
							borderColor: 'rgb(102, 16, 242)',
							tension: 0.1,
							pointStyle: false
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
					},
					scales: {
						x: {
							ticks: {
								maxTicksLimit: 5,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						},
						y: {
							min: 0,
							grace: '5%',
							ticks: {
								precision: 0,
								font: {
									weight: 600
								}
							},
							grid: {
								color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
							}
						}
					},
					interaction: {
						intersect: false
					}
				}
			});

			chartsLoading = false;
		};

		populateCharts();

		const populateMap = () => {
			// add map
			map = leaflet.map(mapElement, { attributionControl: false });

			// add tiles and basemaps
			baseMaps = layers(leaflet, map);

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			// create marker cluster groups
			/* eslint-disable no-undef */
			// @ts-expect-error
			let markers = L.markerClusterGroup();
			/* eslint-enable no-undef */
			let upToDateLayer = leaflet.featureGroup.subGroup(markers);
			let outdatedLayer = leaflet.featureGroup.subGroup(markers);
			let legacyLayer = leaflet.featureGroup.subGroup(markers);

			let overlayMaps = {
				'Up-To-Date': upToDateLayer,
				Outdated: outdatedLayer,
				Legacy: legacyLayer
			};

			leaflet.control.layers(baseMaps, overlayMaps).addTo(map);

			// add locate button to map
			geolocate(leaflet, map);

			// change default icons
			changeDefaultIcons(true, leaflet, mapElement, DomEvent);

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

			// add community area poly to map
			if (community.geo_json) {
				leaflet.geoJSON(community.geo_json, { style: { fill: false } }).addTo(map);
			}

			// add elements to map
			filteredElements.forEach((element) => {
				if (element['deleted_at']) {
					return;
				}

				let icon = element.tags['icon:android'];
				let payment = element.tags['payment:uri']
					? { type: 'uri', url: element.tags['payment:uri'] }
					: element.tags['payment:pouch']
						? { type: 'pouch', username: element.tags['payment:pouch'] }
						: element.tags['payment:coinos']
							? { type: 'coinos', username: element.tags['payment:coinos'] }
							: undefined;
				let boosted =
					element.tags['boost:expires'] && Date.parse(element.tags['boost:expires']) > Date.now()
						? element.tags['boost:expires']
						: undefined;

				const elementOSM = element['osm_json'];

				const lat = latCalc(elementOSM);
				const long = longCalc(elementOSM);

				let divIcon = generateIcon(leaflet, icon, boosted ? true : false);

				let marker = generateMarker(
					lat,
					long,
					divIcon,
					elementOSM,
					payment,
					leaflet,
					verifiedDate,
					true,
					boosted
				);

				let verified = verifiedArr(elementOSM);

				if (verified.length && Date.parse(verified[0]) > verifiedDate) {
					upToDateLayer.addLayer(marker);
				} else {
					outdatedLayer.addLayer(marker);
				}

				if (elementOSM.tags && elementOSM.tags['payment:bitcoin']) {
					legacyLayer.addLayer(marker);
				}
			});

			map.addLayer(markers);
			map.addLayer(upToDateLayer);
			map.addLayer(outdatedLayer);
			map.addLayer(legacyLayer);

			map.fitBounds(
				// @ts-expect-error
				community.geo_json
					? leaflet.geoJSON(community.geo_json).getBounds()
					: [
							[community['box:south'], community['box:west']],
							[community['box:north'], community['box:east']]
						]
			);

			mapLoaded = true;
		};

		populateMap();

		dataInitialized = true;
	};

	$: $users &&
		$users.length &&
		$events &&
		$events.length &&
		$elements &&
		$elements.length &&
		$areas &&
		$areas.length &&
		$reports &&
		$reports.length &&
		initialRenderComplete &&
		!dataInitialized &&
		initializeData();

	const ticketTypes = ['Add', 'Verify'];
	let showType = 'Add';

	const tickets = data.tickets;
	const ticketError = tickets === 'error' ? true : false;

	$: ticketError && errToast('Could not load open tickets, please try again or contact BTC Map.');

	const add =
		tickets && tickets.length && !ticketError
			? tickets.filter((issue: any) =>
					issue.labels.find((label: any) => label.name === 'location-submission')
				)
			: [];
	const verify =
		tickets && tickets.length && !ticketError
			? tickets.filter((issue: any) =>
					issue.labels.find((label: any) => label.name === 'verify-submission')
				)
			: [];

	const totalTickets = add.length + verify.length;

	let avatar: string;
	const name = data.name;
	let org: string | undefined;
	let sponsor: boolean | undefined;
	let continent: Continents;
	let website: string | undefined;
	let email: string | undefined;
	let nostr: string | undefined;
	let twitter: string | undefined;
	let secondTwitter: string | undefined;
	let meetup: string | undefined;
	let eventbrite: string | undefined;
	let telegram: string | undefined;
	let discord: string | undefined;
	let youtube: string | undefined;
	let github: string | undefined;
	let reddit: string | undefined;
	let instagram: string | undefined;
	let whatsapp: string | undefined;
	let facebook: string | undefined;
	let linkedin: string | undefined;
	let rss: string | undefined;
	let signal: string | undefined;
	let lightning: { destination: string; type: TipType } | undefined;

	let total: number | undefined;
	let upToDate: number | undefined;
	let outdated: number | undefined;
	let legacy: number | undefined;
	let grade: Grade;

	let gradeTooltip: HTMLButtonElement;

	$: gradeTooltip &&
		tippy([gradeTooltip], {
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

	let upToDatePercent: string | undefined;
	let outdatedPercent: string | undefined;
	let legacyPercent: string | undefined;

	let updatedChartCanvas: HTMLCanvasElement;
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	let updatedChart;

	let hideArrow = false;
	let activityDiv: HTMLDivElement;
	let eventElements: ActivityEvent[] = [];

	let eventCount = 50;
	$: eventElementsPaginated = eventElements.slice(0, eventCount);

	let taggers: User[] = [];
	let taggerCount = 50;
	$: taggersPaginated = taggers.slice(0, taggerCount);
	let taggerDiv: HTMLDivElement;

	let mapElement: HTMLDivElement;
	let map: Map;
	let mapLoaded = false;

	let baseMaps: BaseMaps;

	let chartsLoading = true;
	let upToDateChartCanvas: HTMLCanvasElement;
	let upToDateChart: Chart<'line', number[], string>;
	let totalChartCanvas: HTMLCanvasElement;
	let totalChart: Chart<'line', number[], string>;
	let legacyChartCanvas: HTMLCanvasElement;
	let legacyChart: Chart<'line', number[], string>;
	let paymentMethodChartCanvas: HTMLCanvasElement;
	let paymentMethodChart: Chart<'line', number[], string>;

	$: $theme !== undefined &&
		!chartsLoading &&
		updateChartThemes([upToDateChart, totalChart, legacyChart, paymentMethodChart]);

	let leaflet: Leaflet;
	let DomEvent: DomEventType;

	onMount(async () => {
		if (browser) {
			// setup charts
			updatedChartCanvas.getContext('2d');
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			legacyChartCanvas.getContext('2d');
			paymentMethodChartCanvas.getContext('2d');

			//import packages
			leaflet = await import('leaflet');
			// @ts-expect-error
			DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			initialRenderComplete = true;
		}
	});

	$: $theme !== undefined && mapLoaded && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			baseMaps['OSM Bright'].remove();
			baseMaps['Alidade Smooth Dark'].addTo(map);
		} else {
			baseMaps['Alidade Smooth Dark'].remove();
			baseMaps['OSM Bright'].addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded && toggleTheme();

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<svelte:head>
	<title>{$page.data.name} - BTC Map Community</title>
	<meta property="og:image" content="https://btcmap.org/images/og/communities.png" />
	<meta property="twitter:title" content="{$page.data.name} - BTC Map Community" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/communities.png" />

	{#if lightning && lightning.type === 'address'}
		<meta name="lightning" content="lnurlp:{lightning.destination}" />
		<meta property="alby:image" content={avatar} />
		<meta property="alby:name" content={name} />
	{:else}
		<meta
			name="lightning"
			content="lnurlp:LNURL1DP68GURN8GHJ7CM0WFJJUCN5VDKKZUPWDAEXWTMVDE6HYMRS9ARKXVN4W5EQPSYZ34"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="my-10 space-y-16 text-center md:my-20">
			<section id="profile" class="space-y-8">
				<div class="space-y-2">
					{#if avatar}
						<img
							src={avatar}
							alt="avatar"
							class="mx-auto h-32 w-32 rounded-full object-cover"
							on:error={function () {
								this.src = '/images/communities/bitcoin.svg';
							}}
						/>
					{:else}
						<div class="mx-auto h-32 w-32 animate-pulse rounded-full bg-link/50" />
					{/if}
					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{name}
					</h1>
					{#if org}
						<OrgBadge {org} />
					{/if}
					{#if sponsor}
						<SponsorBadge />
					{/if}
					{#if continent}
						<h2 class="text-xl uppercase text-primary dark:text-white">
							{continent.replace('-', ' ')}
							<i
								class="fa-solid fa-earth-{continent === 'africa'
									? 'africa'
									: continent === 'asia'
										? 'asia'
										: continent === 'europe'
											? 'europe'
											: continent === 'north-america'
												? 'americas'
												: continent === 'oceania'
													? 'oceania'
													: continent === 'south-america'
														? 'americas'
														: ''}"
							/>
						</h2>
					{:else}
						<div class="mx-auto h-7 w-24 animate-pulse rounded bg-link/50" />
					{/if}
					<a
						href={`/communities/map?community=${data.id}`}
						class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
						>View on community map <svg
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
				</div>

				{#if dataInitialized}
					<Socials
						{website}
						{email}
						{nostr}
						{twitter}
						{secondTwitter}
						{meetup}
						{eventbrite}
						{telegram}
						{discord}
						{youtube}
						{github}
						{reddit}
						{instagram}
						{whatsapp}
						{facebook}
						{linkedin}
						{rss}
						{signal}
					/>
				{:else}
					<div class="flex flex-wrap items-center justify-center">
						<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
						{#each Array(3) as skeleton}
							<div class="m-1 h-10 w-10 animate-pulse rounded-full bg-link/50" />
						{/each}
					</div>
				{/if}

				{#if lightning}
					<Tip destination={lightning.destination} type={lightning.type} user={name} />
				{/if}
			</section>

			<section id="map-section">
				<h3
					class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white md:text-left"
				>
					{name} Map
					<div class="flex items-center space-x-1 text-link">
						{#if dataInitialized}
							<div class="flex items-center space-x-1">
								<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
								{#each Array(grade) as star}
									<i class="fa-solid fa-star" />
								{/each}
							</div>

							<div class="flex items-center space-x-1">
								<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
								{#each Array(5 - grade) as star}
									<i class="fa-solid fa-star opacity-25" />
								{/each}
							</div>
						{:else}
							<div class="flex items-center space-x-1">
								<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
								{#each Array(5) as star}
									<i class="fa-solid fa-star animate-pulse text-link/50" />
								{/each}
							</div>
						{/if}

						<button bind:this={gradeTooltip}>
							<i class="fa-solid fa-circle-info text-sm" />
						</button>
					</div>
				</h3>

				<div class="relative">
					<div
						bind:this={mapElement}
						class="z-10 h-[300px] rounded-b-3xl border border-statBorder !bg-teal text-left dark:!bg-[#202f33] md:h-[600px]"
					/>
					{#if !mapLoaded}
						<MapLoadingEmbed
							style="h-[300px] md:h-[600px] border border-statBorder rounded-b-3xl"
						/>
					{/if}
				</div>
			</section>

			<section id="stats">
				<div
					class="border border-statBorder dark:bg-white/10 {total === 0
						? 'rounded-3xl'
						: 'rounded-t-3xl'} grid md:grid-cols-2 xl:grid-cols-4"
				>
					<ProfileStat
						title="Total Locations"
						stat={total}
						border="border-b xl:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat
						title="Up-To-Date"
						stat={upToDate}
						percent={total && total > 0 ? upToDatePercent : undefined}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
						tooltip="Locations that have been verified within one year."
					/>
					<ProfileStat
						title="Outdated"
						stat={outdated}
						percent={total && total > 0 ? outdatedPercent : undefined}
						border="border-b md:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat
						title="Legacy"
						stat={legacy}
						percent={total && total > 0 ? legacyPercent : undefined}
						tooltip="Locations with a <em>payment:bitcoin</em> tag instead of the
					<em>currency:XBT</em> tag."
					/>
				</div>

				<div
					class="{total === 0
						? 'hidden'
						: ''} relative rounded-b-3xl border border-t-0 border-statBorder p-5 dark:bg-white/10"
				>
					{#if chartsLoading}
						<div>
							<i
								class="fa-solid fa-chart-pie absolute left-1/2 top-1/2 h-52 w-52 -translate-x-1/2 -translate-y-1/2 animate-pulse text-link/50 md:h-60 md:w-60"
							/>
						</div>
					{/if}

					<canvas bind:this={updatedChartCanvas} width="100%" height="250" />
				</div>
			</section>

			<section id="taggers">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{name} Supertaggers
					</h3>
					<div bind:this={taggerDiv} class="hide-scroll max-h-[375px] overflow-scroll p-1">
						{#if taggers && taggers.length}
							<div class="flex flex-wrap items-center justify-center">
								{#each taggersPaginated as tagger}
									<div class="m-4 space-y-1 transition-transform hover:scale-110">
										<a href="/tagger/{tagger.id}">
											<img
												src={tagger.osm_json.img
													? tagger.osm_json.img.href
													: '/images/satoshi-nakamoto.png'}
												alt="avatar"
												class="mx-auto h-20 w-20 rounded-full object-cover"
												on:error={function () {
													this.src = '/images/satoshi-nakamoto.png';
												}}
											/>
											<p class="text-center font-semibold text-body dark:text-white">
												{tagger.osm_json.display_name.length > 21
													? tagger.osm_json.display_name.slice(0, 18) + '...'
													: tagger.osm_json.display_name}
											</p>
										</a>
									</div>
								{/each}
							</div>

							{#if taggersPaginated.length !== taggers.length}
								<button
									class="mx-auto !mb-4 block text-xl font-semibold text-link transition-colors hover:text-hover"
									on:click={() => (taggerCount = taggerCount + 50)}>Load More</button
								>
							{/if}
						{:else if !dataInitialized}
							<div class="flex flex-wrap items-center justify-center">
								<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
								{#each Array(5) as tagger}
									<div class="m-4 space-y-1 transition-transform hover:scale-110">
										<p class="mx-auto h-20 w-20 animate-pulse rounded-full bg-link/50" />
										<p class="mx-auto h-5 w-28 animate-pulse rounded bg-link/50" />
									</div>
								{/each}
							</div>
						{:else}
							<p class="p-5 text-center text-body dark:text-white">No supertaggers to display.</p>
						{/if}
					</div>
				</div>
			</section>

			<section id="activity">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{name} Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll relative max-h-[375px] space-y-2 overflow-y-scroll"
						on:scroll={() => {
							if (dataInitialized && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length}
							{#each eventElementsPaginated as event}
								<LatestTagger
									location={event.location}
									action={event.type}
									user={event.tagger}
									time={event['created_at']}
									latest={event === eventElements[0] ? true : false}
									merchantId={event.merchantId}
								/>
							{/each}

							{#if eventElementsPaginated.length !== eventElements.length}
								<button
									class="mx-auto !mb-5 block text-xl font-semibold text-link transition-colors hover:text-hover"
									on:click={() => (eventCount = eventCount + 50)}>Load More</button
								>
							{:else if eventElements.length > 10}
								<TopButton scroll={activityDiv} style="!mb-5" />
							{/if}

							{#if !hideArrow && eventElements.length > 5}
								<svg
									class="absolute bottom-4 left-[calc(50%-8px)] z-20 h-4 w-4 animate-bounce text-primary dark:text-white"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 512"
									><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
										d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
									/></svg
								>
							{/if}
						{:else if !dataInitialized}
							<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
							{#each Array(5) as skeleton}
								<TaggerSkeleton />
							{/each}
						{:else}
							<p class="p-5 text-body dark:text-white">No activity to display.</p>
						{/if}
					</div>
				</div>
			</section>

			<section id="tickets">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<div class="p-5 text-lg font-semibold text-primary dark:text-white">
						<h3 class="mb-2 text-center md:text-left">
							{name} Tickets
							{#if !ticketError}
								<span class="text-base">({totalTickets})</span>
							{/if}
							<InfoTooltip
								tooltip="Tickets up for grabs from our noob forms! Anybody can help add or verify submissions on OpenStreetMap."
							/>
						</h3>

						{#each ticketTypes as type}
							<button
								class="mx-auto block w-40 border border-link py-2 text-center md:inline {type ===
								'Add'
									? 'rounded-t md:rounded-l md:rounded-tr-none'
									: type === 'Verify'
										? 'rounded-b md:rounded-r md:rounded-bl-none'
										: ''} {showType === type ? 'bg-link text-white' : ''} transition-colors"
								on:click={() => (showType = type)}>{type}</button
							>
						{/each}
					</div>

					{#if !ticketError}
						{#if showType === 'Add'}
							{#if add.length}
								{#each add as ticket}
									<OpenTicket
										assignees={ticket.assignees}
										comments={ticket.comments}
										created={ticket.created_at}
										url={ticket.html_url}
										labels={ticket.labels}
										id={ticket.number}
										name={ticket.title}
										user={ticket.user}
									/>
								{/each}
							{:else}
								<p class="border-t border-statBorder p-5 text-center text-body dark:text-white">
									No open <strong>add</strong> tickets.
								</p>
							{/if}
						{:else if showType === 'Verify'}
							{#if verify.length}
								{#each verify as ticket}
									<OpenTicket
										assignees={ticket.assignees}
										comments={ticket.comments}
										created={ticket.created_at}
										url={ticket.html_url}
										labels={ticket.labels}
										id={ticket.number}
										name={ticket.title}
										user={ticket.user}
									/>
								{/each}
							{:else}
								<p class="border-t border-statBorder p-5 text-center text-body dark:text-white">
									No open <strong>verify</strong> tickets.
								</p>
							{/if}
						{/if}

						{#if tickets.length === 100}
							<p
								class="border-t border-statBorder p-5 text-center font-semibold text-primary dark:text-white"
							>
								View all open tickets directly on <a
									href="https://github.com/teambtcmap/btcmap-data/issues?q=is%3Aopen+is%3Aissue+label%3A%22{name.replaceAll(
										' ',
										'+'
									)}%22"
									target="_blank"
									rel="noreferrer"
									class="text-link transition-colors hover:text-hover">GitHub</a
								>.
							</p>
						{/if}
					{:else}
						<p class="border-t border-statBorder p-5 text-center text-body dark:text-white">
							Error fetching tickets.
						</p>
					{/if}
				</div>
			</section>

			<section id="charts" class="space-y-10">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{name} Charts
					</h3>
					<div class="border-b border-statBorder p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
								>
									<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
								</div>
							{/if}
							<canvas bind:this={upToDateChartCanvas} width="100%" height="400" />
						</div>
						<p class="mt-1 text-center text-sm text-body dark:text-white">
							*Locations with a <em>survey:date</em>, <em>check_date</em>, or
							<em>check_date:currency:XBT</em> tag less than one year old.
						</p>
					</div>

					<div class="border-b border-statBorder p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
								>
									<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
								</div>
							{/if}
							<canvas bind:this={totalChartCanvas} width="100%" height="400" />
						</div>
						<p class="mt-1 text-center text-sm text-body dark:text-white">
							*Locations accepting any bitcoin payment method.
						</p>
					</div>

					<div class="border-b border-statBorder p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
								>
									<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
								</div>
							{/if}
							<canvas bind:this={legacyChartCanvas} width="100%" height="400" />
						</div>
						<p class="mt-1 text-center text-sm text-body dark:text-white">
							*Locations with a <em>payment:bitcoin</em> tag instead of the
							<em>currency:XBT</em> tag.
						</p>
					</div>

					<div class="p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute left-0 top-0 flex h-[400px] w-full animate-pulse items-center justify-center rounded-3xl border border-link/50"
								>
									<i class="fa-solid fa-chart-area h-24 w-24 animate-pulse text-link/50" />
								</div>
							{/if}
							<canvas bind:this={paymentMethodChartCanvas} width="100%" height="400" />
						</div>
						<p class="mt-1 text-center text-sm text-body dark:text-white">
							*Locations with <em>payment:onchain</em>, <em>payment:lightning</em> and
							<em>payment:lightning_contactless</em> tags.
						</p>
					</div>
				</div>
			</section>

			<p class="text-center text-sm text-body dark:text-white md:text-left">
				*More information on bitcoin mapping tags can be found <a
					href="https://wiki.btcmap.org/general/tagging-instructions.html#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">here</a
				>.
			</p>
		</main>

		<Footer />
	</div>
</div>
