<script lang="ts">
	import InfoTooltip from '$components/InfoTooltip.svelte';
	import OpenTicket from '$components/OpenTicket.svelte';
	import { GITEA_LABELS } from '$lib/constants';
	import type { Tickets } from '$lib/types.js';
	import { errToast } from '$lib/utils';

	import type { GiteaLabel, GiteaIssue } from '$lib/types';

	export let title: string;
	export let tickets: Tickets;

	$: filteredTickets = tickets === 'error' ? [] : tickets;

	$: add = filteredTickets.filter((issue: GiteaIssue) =>
		issue.labels.some((label: GiteaLabel) => label.id === GITEA_LABELS.DATA.ADD_LOCATION)
	);
	$: verify = filteredTickets.filter((issue: GiteaIssue) =>
		issue.labels.some((label: GiteaLabel) => label.id === GITEA_LABELS.DATA.VERIFY_LOCATION)
	);
	$: community = filteredTickets.filter((issue: GiteaIssue) =>
		issue.labels.some((label: GiteaLabel) => label.id === GITEA_LABELS.DATA.COMMUNITY_SUBMISSION)
	);

	const ticketTypes = ['Add', 'Verify', 'Community'];
	let showType = 'Add';

	$: ticketError = tickets === 'error';

	$: if (ticketError) {
		errToast('Could not load open tickets, please try again or contact BTC Map.');
	}

	$: totalTickets = add.length + verify.length + community.length;
</script>

<section id="tickets">
	<div class="w-full rounded-3xl border border-gray-300 dark:border-white/95 dark:bg-white/10">
		<div class="p-5 text-lg font-semibold text-primary dark:text-white">
			<h3 class="mb-2 text-center md:text-left">
				{title}
				{#if filteredTickets.length && !ticketError}
					<span class="text-base">({totalTickets})</span>
				{/if}
				<InfoTooltip
					tooltip="Tickets up for grabs from our noob forms! Anybody can help add or verify submissions on OpenStreetMap."
				/>
			</h3>

			{#each ticketTypes as type (type)}
				<button
					class="mx-auto block w-40 border border-link py-2 text-center md:inline {type === 'Add'
						? 'rounded-t md:rounded-l md:rounded-tr-none'
						: type === 'Verify'
							? 'rounded-b md:rounded-r md:rounded-bl-none'
							: ''} {showType === type ? 'bg-link text-white' : ''} transition-colors"
					on:click={() => (showType = type)}
					disabled={!filteredTickets.length || ticketError}
				>
					{type}
				</button>
			{/each}
		</div>

		{#if filteredTickets.length && !ticketError}
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
		{:else if ticketError}
			<p
				class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
			>
				Error fetching tickets. Please try again or contact BTC Map support.
			</p>
		{/if}
	</div>
</section>
