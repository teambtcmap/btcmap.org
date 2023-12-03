<script lang="ts">
	export let data;

	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import {
		Footer,
		Header,
		InfoTooltip,
		LatestTagger,
		MapLoading,
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
	import { areas, elements, events, reports, theme, users } from '$lib/store';
	import { TipType, type ActivityEvent, type BaseMaps, type User } from '$lib/types.js';
	import { detectTheme, errToast, updateChartThemes } from '$lib/utils';
	// @ts-expect-error
	import rewind from '@mapbox/geojson-rewind';
	import Chart from 'chart.js/auto';
	import { geoContains } from 'd3-geo';
	import type { Map } from 'leaflet';
	import { onDestroy, onMount } from 'svelte';
	import tippy from 'tippy.js';

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
	}

	let communityReports = $reports
		.filter((report) => report.area_id === data.id)
		.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

	if (!communityReports.length) {
		console.log(
			'Could not find any community reports, please try again tomorrow or contact BTC Map.'
		);
		goto('/404');
	}

	const community = communityFound?.tags;

	const ticketTypes = ['Add', 'Verify'];
	let showType = 'Add';

	const tickets = data.tickets;
	const totalTickets = tickets.length;
	const ticketError = tickets === 'error' ? true : false;

	$: ticketError && errToast('Could not load open tickets, please try again or contact BTC Map.');

	const add =
		tickets &&
		tickets.length &&
		!ticketError &&
		tickets.filter((issue: any) =>
			issue.labels.find((label: any) => label.name === 'location-submission')
		);
	const verify =
		tickets &&
		tickets.length &&
		!ticketError &&
		tickets.filter((issue: any) =>
			issue.labels.find((label: any) => label.name === 'verify-submission')
		);

	let avatar = community?.['icon:square'];
	let name = data.name;
	let org = community?.organization;
	let sponsor = community?.sponsor;
	let continent = community?.continent;
	let website = community?.['contact:website'];
	let email = community?.['contact:email'];
	let nostr = community?.['contact:nostr'];
	let twitter = community?.['contact:twitter'];
	let secondTwitter = community?.['contact:second_twitter'];
	let meetup = community?.['contact:meetup'];
	let eventbrite = community?.['contact:eventbrite'];
	let telegram = community?.['contact:telegram'];
	let discord = community?.['contact:discord'];
	let youtube = community?.['contact:youtube'];
	let github = community?.['contact:github'];
	let reddit = community?.['contact:reddit'];
	let instagram = community?.['contact:instagram'];
	let whatsapp = community?.['contact:whatsapp'];
	let facebook = community?.['contact:facebook'];
	let linkedin = community?.['contact:linkedin'];
	let rss = community?.['contact:rss'];
	let signal = community?.['contact:signal'];
	$: lightning =
		(community?.['tips:lightning_address'] && {
			destination: community?.['tips:lightning_address'],
			type: TipType.Address
		}) ||
		(community?.['tips:url'] && { destination: community?.['tips:url'], type: TipType.Url });

	let latestReport = communityReports[0].tags;
	let total = latestReport.total_elements || 0;
	let upToDate = latestReport.up_to_date_elements || 0;
	let outdated = latestReport.outdated_elements || 0;
	let legacy = latestReport.legacy_elements || 0;
	let grade = latestReport.grade || 0;

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

	let upToDatePercent = new Intl.NumberFormat('en-US').format(
		Number((upToDate / (total / 100)).toFixed(0))
	);

	let outdatedPercent = new Intl.NumberFormat('en-US').format(
		Number((outdated / (total / 100)).toFixed(0))
	);

	let legacyPercent = new Intl.NumberFormat('en-US').format(
		Number((legacy / (total / 100)).toFixed(0))
	);

	let updatedChartCanvas: HTMLCanvasElement;
	// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
	let updatedChart;

	let loading = true;

	let rewoundPoly = community?.geo_json ? rewind(community.geo_json, true) : undefined;

	// filter elements within community
	let filteredElements = $elements.filter((element) => {
		let lat = latCalc(element['osm_json']);
		let long = longCalc(element['osm_json']);

		if (community?.geo_json) {
			if (geoContains(rewoundPoly, [long, lat])) {
				return true;
			} else {
				return false;
			}
		} else if (
			lat >= Number(community?.['box:south']) &&
			lat <= Number(community?.['box:north']) &&
			long >= Number(community?.['box:west']) &&
			long <= Number(community?.['box:east'])
		) {
			return true;
		} else {
			return false;
		}
	});

	let hideArrow = false;
	let activityDiv;
	let eventElements: ActivityEvent[] = [];

	let communityEvents = $events.filter((event) =>
		filteredElements.find((element) => element.id === event.element_id)
	);

	communityEvents.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

	communityEvents.forEach((event) => {
		let elementMatch = filteredElements.find((element) => element.id === event['element_id']);

		if (elementMatch) {
			let location =
				elementMatch['osm_json'].tags && elementMatch['osm_json'].tags.name
					? elementMatch['osm_json'].tags.name
					: undefined;

			eventElements.push({
				...event,
				location: location || 'Unnamed element',
				merchantId: elementMatch.id
			});
		}
	});

	let eventCount = 50;
	$: eventElementsPaginated = eventElements.slice(0, eventCount);

	loading = false;

	let taggers: User[];
	$: taggers = [];

	const findUser = (tagger: ActivityEvent) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);

		if (foundUser) {
			if (!taggers.find((tagger) => tagger.id === foundUser?.id)) {
				taggers.push(foundUser);
			}

			return foundUser;
		} else {
			return '';
		}
	};

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

	let chartsReports = [...communityReports].sort(
		(a, b) => Date.parse(a['created_at']) - Date.parse(b['created_at'])
	);

	const populateCharts = () => {
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
								weight: '600'
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
						tension: 0.1
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: '600'
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: '600'
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
								weight: '600'
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
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
						tension: 0.1
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: '600'
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: '600'
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
								weight: '600'
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
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
						tension: 0.1
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: '600'
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: '600'
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
								weight: '600'
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
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
						tension: 0.1
					},
					{
						label: 'Lightning',
						data: chartsReports.map(
							({ tags: { total_elements_lightning } }) => total_elements_lightning
						),
						fill: false,
						borderColor: 'rgb(249, 193, 50)',
						tension: 0.1
					},
					{
						label: 'Contactless',
						data: chartsReports.map(
							({ tags: { total_elements_lightning_contactless } }) =>
								total_elements_lightning_contactless
						),
						fill: false,
						borderColor: 'rgb(102, 16, 242)',
						tension: 0.1
					}
				]
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: {
						labels: {
							font: {
								weight: '600'
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: '600'
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
								weight: '600'
							}
						},
						grid: {
							color: theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'
						}
					}
				}
			}
		});

		chartsLoading = false;
	};

	$: $theme !== undefined &&
		chartsLoading === false &&
		updateChartThemes([upToDateChart, totalChart, legacyChart, paymentMethodChart]);

	onMount(async () => {
		if (browser) {
			// setup charts
			updatedChartCanvas.getContext('2d');
			upToDateChartCanvas.getContext('2d');
			totalChartCanvas.getContext('2d');
			legacyChartCanvas.getContext('2d');
			paymentMethodChartCanvas.getContext('2d');
			populateCharts();

			//import packages
			const leaflet = await import('leaflet');
			// @ts-expect-error
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
			const leafletMarkerCluster = await import('leaflet.markercluster');
			const leafletFeaturegroupSubgroup = await import('leaflet.featuregroup.subgroup');
			const leafletLocateControl = await import('leaflet.locatecontrol');
			/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

			// add map
			map = leaflet.map(mapElement, { attributionControl: false });

			// add tiles and basemaps
			baseMaps = layers(leaflet, map);

			// change broken marker image path in prod
			leaflet.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(leaflet, map);

			// create marker cluster groups
			// eslint-disable-next-line no-undef
			let markers = L.markerClusterGroup();
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
			if (community?.geo_json) {
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
				community?.geo_json
					? leaflet.geoJSON(community.geo_json).getBounds()
					: [
							[community?.['box:south'], community?.['box:west']],
							[community?.['box:north'], community?.['box:east']]
					  ]
			);

			mapLoaded = true;
		}
	});

	$: $theme !== undefined && mapLoaded === true && toggleMapButtons();

	const closePopup = () => {
		map.closePopup();
	};

	$: $theme !== undefined && mapLoaded === true && closePopup();

	const toggleTheme = () => {
		if ($theme === 'dark') {
			baseMaps['OSM Bright'].remove();
			baseMaps['Alidade Smooth Dark'].addTo(map);
		} else {
			baseMaps['Alidade Smooth Dark'].remove();
			baseMaps['OSM Bright'].addTo(map);
		}
	};

	$: $theme !== undefined && mapLoaded === true && toggleTheme();

	onDestroy(async () => {
		if (map) {
			console.log('Unloading Leaflet map.');
			map.remove();
		}
	});
</script>

<svelte:head>
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
					<img
						src={avatar}
						alt="avatar"
						class="mx-auto h-32 w-32 rounded-full object-cover"
						on:error={function () {
							this.src = '/images/communities/bitcoin.svg';
						}}
					/>
					<h1 class="text-4xl font-semibold !leading-tight text-primary dark:text-white">
						{name}
					</h1>
					{#if org}
						<OrgBadge {org} />
					{/if}
					{#if sponsor}
						<SponsorBadge />
					{/if}
					<h2 class="text-xl uppercase text-primary dark:text-white">
						{continent?.replace('-', ' ')}
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
					<a
						href={community?.geo_json
							? `/map?community=${data.id}`
							: `/map?lat=${community?.['box:south']}&long=${community?.['box:west']}&lat=${community?.['box:north']}&long=${community?.['box:east']}`}
						class="inline-flex items-center justify-center text-xs text-link transition-colors hover:text-hover"
						>View on main map <svg
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

				{#if lightning}
					<Tip destination={lightning.destination} type={lightning.type} user={name} />
				{/if}
			</section>

			<section id="map-section">
				<h3
					class="rounded-t-3xl border border-b-0 border-statBorder p-5 text-center text-lg font-semibold text-primary dark:bg-white/10 dark:text-white md:text-left"
				>
					{name} Map
					<div class="space-x-1 text-link">
						<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
						{#each Array(grade) as star}
							<i class="fa-solid fa-star" />
						{/each}

						<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
						{#each Array(5 - grade) as star}
							<i class="fa-solid fa-star opacity-25" />
						{/each}

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
						<MapLoading
							type="embed"
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
						percent=""
						border="border-b xl:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat
						title="Up-To-Date"
						stat={upToDate}
						percent={total > 0 ? upToDatePercent : ''}
						border="border-b xl:border-b-0 xl:border-r border-statBorder"
						tooltip="Locations that have been verified within one year."
					/>
					<ProfileStat
						title="Outdated"
						stat={outdated}
						percent={total > 0 ? outdatedPercent : ''}
						border="border-b md:border-b-0 md:border-r border-statBorder"
					/>
					<ProfileStat
						title="Legacy"
						stat={legacy}
						percent={total > 0 ? legacyPercent : ''}
						border=""
						tooltip="Locations with a <em>payment:bitcoin</em> tag instead of the
					<em>currency:XBT</em> tag."
					/>
				</div>

				<div
					class="{total === 0
						? 'hidden'
						: ''} rounded-b-3xl border border-t-0 border-statBorder p-5 dark:bg-white/10"
				>
					<canvas bind:this={updatedChartCanvas} width="250" height="250" />
				</div>
			</section>

			<section id="taggers">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<h3
						class="border-b border-statBorder p-5 text-center text-lg font-semibold text-primary dark:text-white md:text-left"
					>
						{name} Supertaggers
					</h3>
					<div
						class="hide-scroll flex max-h-[375px] flex-wrap items-center justify-center overflow-scroll p-1"
					>
						{#if taggers && taggers.length}
							{#each taggers as tagger}
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
						{:else if !communityEvents.length}
							<p class="p-5 text-body dark:text-white">No supertaggers to display.</p>
						{:else}
							<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
							{#each Array(5) as tagger}
								<div class="m-4 space-y-1 transition-transform hover:scale-110">
									<p class="mx-auto h-20 w-20 animate-pulse rounded-full bg-link/50" />
									<p class="mx-auto h-5 w-28 animate-pulse rounded bg-link/50" />
								</div>
							{/each}
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
							if (!loading && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length && !loading}
							{#each eventElementsPaginated as event}
								<LatestTagger
									location={event.location}
									action={event.type}
									user={findUser(event)}
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
						{:else if !communityEvents.length}
							<p class="p-5 text-body dark:text-white">No activity to display.</p>
						{:else}
							<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
							{#each Array(5) as skeleton}
								<TaggerSkeleton />
							{/each}
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
									class="absolute left-0 top-0 h-[400px] w-full animate-pulse rounded-3xl border border-link/50"
								/>
							{/if}
							<canvas bind:this={upToDateChartCanvas} width="400" height="400" />
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
									class="absolute left-0 top-0 h-[400px] w-full animate-pulse rounded-3xl border border-link/50"
								/>
							{/if}
							<canvas bind:this={totalChartCanvas} width="400" height="400" />
						</div>
						<p class="mt-1 text-center text-sm text-body dark:text-white">
							*Locations accepting any bitcoin payment method.
						</p>
					</div>

					<div class="border-b border-statBorder p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute left-0 top-0 h-[400px] w-full animate-pulse rounded-3xl border border-link/50"
								/>
							{/if}
							<canvas bind:this={legacyChartCanvas} width="400" height="400" />
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
									class="absolute left-0 top-0 h-[400px] w-full animate-pulse rounded-3xl border border-link/50"
								/>
							{/if}
							<canvas bind:this={paymentMethodChartCanvas} width="400" height="400" />
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

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.css';
	@import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
	@import 'leaflet.locatecontrol/dist/L.Control.Locate.min.css';
	@import 'tippy.js/dist/tippy.css';
</style>
