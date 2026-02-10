<script lang="ts">
	import HeaderPlaceholder from '$components/layout/HeaderPlaceholder.svelte';
	import OpenTicket from '$components/OpenTicket.svelte';
	import OpenTicketSkeleton from './components/OpenTicketSkeleton.svelte';
	import TopButton from '$components/TopButton.svelte';
	import { GITEA_LABELS } from '$lib/constants';
	import { theme } from '$lib/theme';
	import { detectTheme } from '$lib/utils';
	// Temporarily disabled during maintenance
	// import { errToast } from '$lib/utils';

	import type { GiteaLabel, GiteaIssue } from '$lib/types';

	const ticketTypes = ['Add', 'Verify', 'Community'];
	let showType = 'Add';

	export let data;

	$: tickets = data.tickets as GiteaIssue[];

	$: add =
		tickets?.filter((issue) =>
			issue?.labels?.some((label: GiteaLabel) => label?.id === GITEA_LABELS.DATA.ADD_LOCATION)
		) || [];
	$: verify =
		tickets?.filter((issue) =>
			issue?.labels?.some((label: GiteaLabel) => label?.id === GITEA_LABELS.DATA.VERIFY_LOCATION)
		) || [];
	$: community =
		tickets?.filter((issue) =>
			issue?.labels?.some(
				(label: GiteaLabel) => label?.id === GITEA_LABELS.DATA.COMMUNITY_SUBMISSION
			)
		) || [];

	let totalTickets = data.totalTickets;

	// Temporarily disabled during maintenance
	// if (data.error) {
	// 	errToast(data.error);
	// }

	const isMaintenance = data.maintenance ?? false;
</script>

<svelte:head>
	<title>BTC Map - Open Tickets</title>
	<meta property="og:image" content="https://btcmap.org/images/og/home.png" />
	<meta property="twitter:title" content="BTC Map - Open Tickets" />
	<meta property="twitter:image" content="https://btcmap.org/images/og/home.png" />
</svelte:head>

<main class="mt-10 mb-20 space-y-10">
	{#if typeof window !== 'undefined'}
		<h1
			class="{detectTheme() === 'dark' || $theme === 'dark'
				? 'text-white'
				: 'gradient'} text-center text-4xl !leading-tight font-semibold md:text-5xl lg:text-left"
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
		class="w-full text-center text-xl font-semibold text-primary lg:w-[675px] lg:text-left dark:text-white"
	>
		Tickets up for grabs from our noob forms! Anyone can help add or verify location submissions and
		help vet communities.
	</h2>

	<p class="text-center text-xl text-primary lg:text-left dark:text-white">
		More information on how to get involved can be found in our <a
			href="https://gitea.btcmap.org/teambtcmap/btcmap-general/wiki/Tagging-Merchants#shadowy-supertaggers"
			class="text-link transition-colors hover:text-hover">Tagging Merchant Instructions</a
		>.
	</p>

	<section id="tickets">
		<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
			{#if isMaintenance}
				<p class="p-5 text-center text-body dark:text-white">
					Issues are currently under maintenance. <a
						href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues"
						target="_blank"
						rel="noreferrer"
						class="text-link transition-colors hover:text-hover">View issues directly on Gitea</a
					>.
				</p>
			{:else}
				<div class="p-5 text-center text-2xl font-semibold text-primary dark:text-white">
					{#each ticketTypes as type (type)}
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
							{#each add as ticket (ticket.number)}
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
							<p
								class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
							>
								No open <strong>add</strong> tickets.
							</p>
						{/if}
					{:else if showType === 'Verify'}
						{#if verify.length}
							{#each verify as ticket (ticket.number)}
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
							<p
								class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
							>
								No open <strong>verify</strong> tickets.
							</p>
						{/if}
					{:else if showType === 'Community'}
						{#if community.length}
							{#each community as ticket (ticket.number)}
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
							<p
								class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
							>
								No open <strong>community</strong> tickets.
							</p>
						{/if}
					{/if}

					{#if tickets.length === 100}
						<p
							class="border-t border-gray-300 p-5 text-center font-semibold text-primary dark:border-white/95 dark:text-white"
						>
							View all open tickets directly on <a
								href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues"
								target="_blank"
								rel="noreferrer"
								class="text-link transition-colors hover:text-hover">Gitea</a
							>.
						</p>
					{/if}
				{:else}
					{#each Array(10) as _, index (index)}
						<OpenTicketSkeleton />
					{/each}
				{/if}
			{/if}
		</div>
		<p class="text-center text-sm text-body lg:text-left dark:text-white">
			*Data updated every 10 minutes.
		</p>
		<div class="mt-10 flex justify-center">
			<TopButton />
		</div>
	</section>
</main>
