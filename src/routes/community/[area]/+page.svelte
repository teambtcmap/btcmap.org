<script>
	export let data;

	import tippy from 'tippy.js';
	import Chart from 'chart.js/auto';
	import { browser } from '$app/environment';
	import { onMount, onDestroy } from 'svelte';
	import { users, events, elements, areas, reports } from '$lib/store';
	import {
		attribution,
		changeDefaultIcons,
		calcVerifiedDate,
		latCalc,
		longCalc,
		generateIcon,
		generateMarker
	} from '$lib/map/setup';
	import { errToast } from '$lib/utils';
	import { error } from '@sveltejs/kit';
	import {
		Header,
		Footer,
		Tip,
		ProfileStat,
		LatestTagger,
		TaggerSkeleton,
		TopButton,
		MapLoading,
		SponsorBadge
	} from '$comp';

	let community = $areas.find(
		(area) =>
			area.id == data.id &&
			area.tags.type === 'community' &&
			area.tags['box:east'] &&
			area.tags['box:north'] &&
			area.tags['box:south'] &&
			area.tags['box:west'] &&
			area.tags.name &&
			area.tags['icon:square'] &&
			area.tags.continent &&
			Object.keys(area.tags).find((key) => key.includes('contact'))
	);

	if (!community) {
		errToast('Could not find community, please try again or contact BTC Map.');
		throw error(404, 'Community Not Found');
	}

	let communityReports = $reports
		.filter((report) => report.area_id === data.id)
		.sort((a, b) => Date.parse(b['created_at']) - Date.parse(a['created_at']));

	if (!communityReports) {
		errToast('Could not find any community reports, please try again tomorrow or contact BTC Map.');
		throw error(404, 'Community Report Not Found');
	}

	community = community.tags;

	let avatar = community['icon:square'];
	let name = data.name;
	let sponsor = community.sponsor;
	let continent = community.continent;
	let website = community['contact:website'];
	let twitter = community['contact:twitter'];
	let secondTwitter = community['contact:second_twitter'];
	let telegram = community['contact:telegram'];
	let discord = community['contact:discord'];
	let youtube = community['contact:youtube'];
	let github = community['contact:github'];
	$: lightning =
		(community['tips:lightning_address'] && {
			destination: community['tips:lightning_address'],
			type: 'address'
		}) ||
		(community['tips:url'] && { destination: community['tips:url'], type: 'url' });

	let latestReport = communityReports[0].tags;
	let total = latestReport.total_elements || 0;
	let upToDate = latestReport.up_to_date_elements || 0;
	let outdated = latestReport.outdated_elements || 0;
	let legacy = latestReport.legacy_elements || 0;
	let grade = latestReport.grade || 0;

	let gradeTooltip;

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

	let upToDatePercent = new Intl.NumberFormat('en-US')
		.format((upToDate / (total / 100)).toFixed(0))
		.toString();

	let outdatedPercent = new Intl.NumberFormat('en-US')
		.format((outdated / (total / 100)).toFixed(0))
		.toString();

	let legacyPercent = new Intl.NumberFormat('en-US')
		.format((legacy / (total / 100)).toFixed(0))
		.toString();

	let updatedChartCanvas;
	let updatedChart;

	let loading = true;

	// filter elements within community
	let filteredElements = $elements.filter((element) => {
		let lat = latCalc(element['osm_json']);
		let long = longCalc(element['osm_json']);

		if (
			lat >= community['box:south'] &&
			lat <= community['box:north'] &&
			long >= community['box:west'] &&
			long <= community['box:east']
		) {
			return true;
		} else {
			return false;
		}
	});

	let hideArrow = false;
	let activityDiv;
	let eventElements = [];

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

			event.location = location ? location : 'Unnamed element';
			event.lat = latCalc(elementMatch['osm_json']);
			event.long = longCalc(elementMatch['osm_json']);

			eventElements.push(event);
		}
	});

	loading = false;

	$: taggers = [];

	const findUser = (tagger) => {
		let foundUser = $users.find((user) => user.id == tagger['user_id']);

		if (foundUser) {
			if (!taggers.find((tagger) => tagger.id === foundUser.id)) {
				taggers.push(foundUser);
			}

			return foundUser;
		} else {
			return '';
		}
	};

	let mapElement;
	let map;
	let mapLoaded;

	let chartsLoading = true;
	let upToDateChartCanvas;
	let upToDateChart;
	let totalChartCanvas;
	let totalChart;
	let legacyChartCanvas;
	let legacyChart;
	let paymentMethodChartCanvas;
	let paymentMethodChart;

	let chartsReports = [...communityReports].sort(
		(a, b) => Date.parse(a['created_at']) - Date.parse(b['created_at'])
	);

	const populateCharts = () => {
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

		upToDateChart = new Chart(upToDateChartCanvas, {
			type: 'line',
			data: {
				labels: chartsReports.map(({ date }) => date),
				datasets: [
					{
						label: 'Up-To-Date Percent',
						data: chartsReports.map(({ tags: { up_to_date_percent } }) => up_to_date_percent),
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
								weight: 600
							}
						}
					}
				},
				scales: {
					x: {
						min: '2022-11-30',
						ticks: {
							maxTicksLimit: 5,
							font: {
								weight: 600
							}
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
						}
					}
				}
			}
		});

		chartsLoading = false;
	};

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
			const DomEvent = await import('leaflet/src/dom/DomEvent');
			const leafletMarkerCluster = await import('leaflet.markercluster');

			// add map and tiles
			map = leaflet.map(mapElement, { attributionControl: false });

			const osm = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
				noWrap: true,
				maxZoom: 19
			});

			osm.addTo(map);

			// change broken marker image path in prod
			L.Icon.Default.prototype.options.imagePath = '/icons/';

			// add OSM attribution
			attribution(L, map);

			// change default icons
			changeDefaultIcons('', L, mapElement, DomEvent);

			// create marker cluster group
			let markers = L.markerClusterGroup();

			// get date from 1 year ago to add verified check if survey is current
			let verifiedDate = calcVerifiedDate();

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

				element = element['osm_json'];

				const lat = latCalc(element);
				const long = longCalc(element);

				let campsite = element.tags && element.tags['tourism'] === 'camp_site';

				let divIcon = generateIcon(L, icon, boosted, campsite);

				let marker = generateMarker(
					lat,
					long,
					divIcon,
					element,
					payment,
					L,
					verifiedDate,
					'verify',
					boosted
				);

				markers.addLayer(marker);
			});

			map.addLayer(markers);
			map.fitBounds([
				[community['box:south'], community['box:west']],
				[community['box:north'], community['box:east']]
			]);

			mapLoaded = true;
		}
	});

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
			content="lnurlp:LNURL1DP68GURN8GHJ7ERZXVUXVER9X4SNYTNY9EMX7MR5V9NK2CTSWQHXJME0D3H82UNVWQHKZURF9AMRZTMVDE6HYMP0XYA8GEF9"
		/>
		<meta property="alby:image" content="/images/logo.svg" />
		<meta property="alby:name" content="BTC Map" />
	{/if}
</svelte:head>

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="text-center my-10 md:my-20 space-y-16">
			<section id="profile" class="space-y-8">
				<div class="space-y-2">
					<img src={avatar} alt="avatar" class="rounded-full w-32 h-32 object-cover mx-auto" />
					<h1 class="text-4xl font-semibold text-primary !leading-tight">
						{name}
						{#if sponsor}
							<SponsorBadge />
						{/if}
					</h1>
					<h2 class="text-primary text-xl uppercase">
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
					<a
						href={`/map?lat=${community['box:south']}&long=${community['box:west']}&lat=${community['box:north']}&long=${community['box:east']}`}
						class="text-xs text-link hover:text-hover inline-flex justify-center items-center transition-colors"
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

				<div class="flex flex-wrap justify-center items-center">
					{#if website}
						<a href={website} target="_blank" rel="noreferrer" class="m-1">
							<span
								class="bg-bitcoin w-[40px] h-[40px] flex justify-center items-center rounded-full"
							>
								<i class="text-white w-7 h-7 fa-solid fa-globe" />
							</span>
						</a>
					{/if}
					{#if twitter}
						<a href={twitter} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/twitter.svg" alt="twitter" />
						</a>
					{/if}
					{#if secondTwitter}
						<a href={secondTwitter} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/twitter.svg" alt="twitter" />
						</a>
					{/if}
					{#if telegram}
						<a href={telegram} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/telegram.svg" alt="telegram" />
						</a>
					{/if}
					{#if discord}
						<a href={discord} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/discord.svg" alt="discord" />
						</a>
					{/if}
					{#if youtube}
						<a href={youtube} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/youtube.svg" alt="youtube" />
						</a>
					{/if}
					{#if github}
						<a href={github} target="_blank" rel="noreferrer" class="m-1">
							<img src="/icons/socials/github.svg" alt="github" />
						</a>
					{/if}
				</div>

				{#if lightning}
					<Tip destination={lightning.destination} type={lightning.type} user={name} />
				{/if}
			</section>

			<section id="map-section">
				<h3
					class="text-center md:text-left text-primary text-lg border border-statBorder border-b-0 rounded-t-3xl p-5 font-semibold"
				>
					{name} Map
					<div class="text-link space-x-1">
						{#each Array(grade) as star}
							<i class="fa-solid fa-star" />
						{/each}

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
						class="!bg-teal z-10 border border-statBorder rounded-b-3xl h-[300px] md:h-[600px]"
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
					class="border border-statBorder {total === 0
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
						: ''} border border-statBorder border-t-0 rounded-b-3xl p-5"
				>
					<canvas bind:this={updatedChartCanvas} width="250" height="250" />
				</div>
			</section>

			<section id="taggers">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3 class="text-center text-primary text-lg border-b border-statBorder p-5 font-semibold">
						{name} Supertaggers
					</h3>
					<div class="p-1 flex flex-wrap justify-center items-center">
						{#if taggers && taggers.length}
							{#each taggers as tagger}
								<div class="space-y-1 m-4 hover:scale-110 transition-transform">
									<a href="/tagger/{tagger.id}">
										<img
											src={tagger.osm_json.img
												? tagger.osm_json.img.href
												: '/images/satoshi-nakamoto.png'}
											alt="avatar"
											class="rounded-full w-20 h-20 object-cover mx-auto"
										/>
										<p class="text-body text-center font-semibold">
											{tagger.osm_json.display_name}
										</p>
									</a>
								</div>
							{/each}
						{:else if !communityEvents.length}
							<p class="text-body p-5">No supertaggers to display.</p>
						{:else}
							{#each Array(5) as tagger}
								<div class="space-y-1 m-4 hover:scale-110 transition-transform">
									<p class="bg-link/50 animate-pulse rounded-full w-20 h-20 mx-auto" />
									<p class="bg-link/50 animate-pulse rounded w-28 h-5 mx-auto" />
								</div>
							{/each}
						{/if}
					</div>
				</div>
			</section>

			<section id="activity">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3
						class="text-center md:text-left text-primary text-lg border-b border-statBorder p-5 font-semibold"
					>
						{name} Activity
					</h3>

					<div
						bind:this={activityDiv}
						class="hide-scroll space-y-2 {eventElements.length > 5
							? 'h-[375px]'
							: ''} overflow-y-scroll relative"
						on:scroll={() => {
							if (!loading && !hideArrow) {
								hideArrow = true;
							}
						}}
					>
						{#if eventElements && eventElements.length && !loading}
							{#each eventElements as event}
								<LatestTagger
									location={event.location}
									action={event.type}
									user={findUser(event)}
									time={event['created_at']}
									latest={event === eventElements[0] ? true : false}
									lat={event.lat}
									long={event.long}
								/>
							{/each}

							{#if eventElements.length > 10}
								<TopButton scroll={activityDiv} style="!mb-5" />
							{/if}

							{#if !hideArrow && eventElements.length > 5}
								<svg
									class="z-20 w-4 h-4 animate-bounce text-primary absolute bottom-4 left-[calc(50%-8px)]"
									fill="currentColor"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 512 512"
									><!--! Font Awesome Pro 6.2.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2022 Fonticons, Inc. --><path
										d="M233.4 406.6c12.5 12.5 32.8 12.5 45.3 0l192-192c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L256 338.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l192 192z"
									/></svg
								>
							{/if}
						{:else if !communityEvents.length}
							<p class="text-body p-5">No activity to display.</p>
						{:else}
							{#each Array(5) as skeleton}
								<TaggerSkeleton />
							{/each}
						{/if}
					</div>
				</div>
			</section>

			<section id="charts" class="space-y-10">
				<div class="w-full border border-statBorder rounded-3xl">
					<h3
						class="text-center md:text-left text-primary text-lg border-b border-statBorder p-5 font-semibold"
					>
						{name} Charts
					</h3>
					<div class="p-5 border-b border-statBorder">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
								/>
							{/if}
							<canvas bind:this={upToDateChartCanvas} width="400" height="400" />
						</div>
						<p class="text-sm text-body text-center mt-1">
							*Locations with a <em>survey:date</em>, <em>check_date</em>, or
							<em>check_date:currency:XBT</em> tag less than one year old.
						</p>
					</div>

					<div class="p-5 border-b border-statBorder">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
								/>
							{/if}
							<canvas bind:this={totalChartCanvas} width="400" height="400" />
						</div>
						<p class="text-sm text-body text-center mt-1">
							*Locations accepting any bitcoin payment method.
						</p>
					</div>

					<div class="p-5 border-b border-statBorder">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
								/>
							{/if}
							<canvas bind:this={legacyChartCanvas} width="400" height="400" />
						</div>
						<p class="text-sm text-body text-center mt-1">
							*Locations with a <em>payment:bitcoin</em> tag instead of the
							<em>currency:XBT</em> tag.
						</p>
					</div>

					<div class="p-5">
						<div class="relative">
							{#if chartsLoading}
								<div
									class="absolute top-0 left-0 border border-link/50 rounded-3xl animate-pulse w-full h-[400px]"
								/>
							{/if}
							<canvas bind:this={paymentMethodChartCanvas} width="400" height="400" />
						</div>
						<p class="text-sm text-body text-center mt-1">
							*Locations with <em>payment:onchain</em>, <em>payment:lightning</em> and
							<em>payment:lightning_contactless</em> tags.
						</p>
					</div>
				</div>
			</section>

			<p class="text-sm text-body text-center md:text-left">
				*More information on bitcoin mapping tags can be found <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions#tagging-guidance"
					target="_blank"
					rel="noreferrer"
					class="text-link hover:text-hover transition-colors">here</a
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
	@import 'tippy.js/dist/tippy.css';
</style>
