<script>
	import axios from 'axios';

	import { Header, Footer, OpenTicket, OpenTicketSkeleton, TopButton } from '$comp';
	import { errToast } from '$lib/utils';
	import { onMount, onDestroy } from 'svelte';

	const ticketTypes = ['Add', 'Verify', 'Community'];
	let showType = 'Add';

	let tickets = [];
	let totalTickets;

	$: add =
		tickets &&
		tickets.length &&
		tickets.filter((issue) => issue.labels.find((label) => label.name === 'location-submission'));
	$: verify =
		tickets &&
		tickets.length &&
		tickets.filter((issue) => issue.labels.find((label) => label.name === 'verify-submission'));
	$: community =
		tickets &&
		tickets.length &&
		tickets.filter((issue) => issue.labels.find((label) => label.name === 'community-submission'));

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
				console.log(error);
			});
	};

	let getIssuesInterval;

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

<div class="bg-teal">
	<Header />
	<div class="w-10/12 xl:w-[1200px] mx-auto">
		<main class="space-y-10 mt-10 mb-20">
			<h1
				class="text-center lg:text-left text-4xl md:text-5xl font-semibold text-primary gradient !leading-tight"
			>
				Open Tickets
				{#if totalTickets}
					<span class="text-3xl">({totalTickets})</span>
				{/if}
			</h1>

			<h2 class="text-center lg:text-left text-primary text-xl font-semibold w-full lg:w-[675px]">
				Tickets up for grabs from our noob forms! Anybody can help add or verify submissions on
				OpenStreetMap and prepare community area polygons.
			</h2>

			<p class="text-center lg:text-left text-xl text-primary">
				More information on how to get involved can be found in our <a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Tagging-Instructions"
					class="text-link hover:text-hover transition-colors">Tagging Instructions</a
				>
				and
				<a
					href="https://github.com/teambtcmap/btcmap-data/wiki/Creating-GeoJSON-Areas"
					class="text-link hover:text-hover transition-colors">Creating GeoJSON Areas</a
				> Wiki pages.
			</p>

			<section id="tickets">
				<div class="w-full border border-statBorder rounded-3xl">
					<div class="text-center text-primary text-2xl p-5 font-semibold">
						{#each ticketTypes as type}
							<button
								class="block md:inline mx-auto w-40 py-2 border border-link {type === 'Add'
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
								<p class="text-body text-center p-5 border-t border-statBorder">
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
								<p class="text-body text-center p-5 border-t border-statBorder">
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
								<p class="text-body text-center p-5 border-t border-statBorder">
									No open <strong>community</strong> tickets.
								</p>
							{/if}
						{/if}

						{#if tickets.length === 100}
							<p class="text-primary font-semibold text-center p-5 border-t border-statBorder">
								View all open tickets directly on <a
									href="https://github.com/teambtcmap/btcmap-data/issues"
									target="_blank"
									rel="noreferrer"
									class="text-link hover:text-hover transition-colors">GitHub</a
								>.
							</p>
						{/if}
					{:else}
						{#each Array(10) as skeleton}
							<OpenTicketSkeleton />
						{/each}
					{/if}
				</div>
				<p class="text-sm text-body text-center lg:text-left">*Data updated every 10 minutes.</p>
				<div class="mt-10 flex justify-center">
					<TopButton />
				</div>
			</section>
		</main>

		<Footer />
	</div>
</div>
