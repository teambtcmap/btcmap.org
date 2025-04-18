<script lang="ts">
	import axios from 'axios';

	import {
		Footer,
		Header,
		HeaderPlaceholder,
		OpenTicket,
		OpenTicketSkeleton,
		TopButton
	} from '$lib/comp';
	import { theme } from '$lib/store';
	import { detectTheme, errToast } from '$lib/utils';
	import { onDestroy, onMount } from 'svelte';

	const ticketTypes = ['Add', 'Verify', 'Community'];
	let showType = 'Add';

	let tickets: any[] = [];
	let totalTickets: number;

	$: add =
		tickets && tickets.length
			? tickets.filter((issue) =>
					issue.labels.find((label: any) => label.name === 'location-submission')
				)
			: [];
	$: verify =
		tickets && tickets.length
			? tickets.filter((issue) =>
					issue.labels.find((label: any) => label.name === 'verify-submission')
				)
			: [];
	$: community =
		tickets && tickets.length
			? tickets.filter((issue) =>
					issue.labels.find((label: any) => label.name === 'community-submission')
				)
			: [];

	const getIssues = () => {
		axios
			.get('/tickets/endpoint')
			.then(function (response) {
				// handle success
				tickets = response.data.tickets;
				totalTickets = response.data.totalTickets;
			})
			.catch(function (error) {
				// handle error
				errToast('Could not load open tickets, please try again or contact BTC Map.');
				console.error(error);
			});
	};

	let getIssuesInterval: ReturnType<typeof setInterval>;

	onMount(() => {
		getIssues();
		getIssuesInterval = setInterval(getIssues, 600000);
	});

	onDestroy(() => clearInterval(getIssuesInterval));
</script>

<svelte:head>
	<title>BTC Map - Open Tickets</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Open Tickets" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<div class="bg-teal dark:bg-dark">
	<Header />
	<div class="mx-auto w-10/12 xl:w-[1200px]">
		<main class="mb-20 mt-10 space-y-10">
			{#if typeof window !== 'undefined'}
				<h1
					class="{detectTheme() === 'dark' || $theme === 'dark'
						? 'text-white'
						: 'gradient'} text-center text-4xl font-semibold !leading-tight md:text-5xl lg:text-left"
				>
					Open Tickets
					{#if totalTickets}
						<span class="text-3xl">({totalTickets})</span>
					{/if}
				</h1>
			{:else}
				<HeaderPlaceholder />
			{/if}

			<h2
				class="w-full text-center text-xl font-semibold text-primary dark:text-white lg:w-[675px] lg:text-left"
			>
				Tickets up for grabs from our noob forms! Anybody can help add or verify submissions on
				OpenStreetMap and prepare community area polygons.
			</h2>

			<p class="text-center text-xl text-primary dark:text-white lg:text-left">
				More information on how to get involved can be found in our <a
					href="https://wiki.btcmap.org/general/tagging-instructions.html"
					class="text-link transition-colors hover:text-hover">Tagging Instructions</a
				>
				and
				<a
					href="https://wiki.btcmap.org/general/geojson-areas.html"
					class="text-link transition-colors hover:text-hover">Creating GeoJSON Areas</a
				> Wiki pages.
			</p>

			<section id="tickets">
				<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
					<div class="p-5 text-center text-2xl font-semibold text-primary dark:text-white">
						{#each ticketTypes as type}
							<button
								class="mx-auto block w-40 border border-link py-2 md:inline {type === 'Add'
									? 'rounded-t md:rounded-l md:rounded-tr-none'
									: type === 'Community'
										? 'rounded-b md:rounded-r md:rounded-bl-none'
										: ''} {showType === type ? 'bg-link text-white' : ''} transition-colors"
								on:click={() => (showType = type)}>{type}</button
							>
						{/each}
					</div>

					{#if tickets && tickets.length}
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
						{:else if showType === 'Community'}
							{#if community.length}
								{#each community as ticket}
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
									No open <strong>community</strong> tickets.
								</p>
							{/if}
						{/if}

						{#if tickets.length === 100}
							<p
								class="border-t border-statBorder p-5 text-center font-semibold text-primary dark:text-white"
							>
								View all open tickets directly on <a
									href="https://github.com/teambtcmap/btcmap-data/issues"
									target="_blank"
									rel="noreferrer"
									class="text-link transition-colors hover:text-hover">GitHub</a
								>.
							</p>
						{/if}
					{:else}
						<!-- eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -->
						{#each Array(10) as skeleton}
							<OpenTicketSkeleton />
						{/each}
					{/if}
				</div>
				<p class="text-center text-sm text-body dark:text-white lg:text-left">
					*Data updated every 10 minutes.
				</p>
				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
