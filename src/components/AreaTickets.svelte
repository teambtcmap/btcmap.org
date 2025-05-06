<script lang="ts">
	import { InfoTooltip, OpenTicket } from '$lib/comp';
	import { type Tickets } from '$lib/types.js';
	import { errToast } from '$lib/utils';

	export let name: string;
	export let tickets: Tickets;

	// Updated to fetch all tickets regardless of type. Client-side filtering handles Add/Verify
	$: filteredTickets = tickets === 'error' ? [] : tickets;
	const add = filteredTickets.filter((issue: any) => issue.labels.some((label: any) => label.name === 'location-submission'));
	const verify = filteredTickets.filter((issue: any) => issue.labels.some((label: any) => label.name === 'verify-submission'));

	const ticketTypes = ['Add', 'Verify'];
	let showType = 'Add';

	const ticketError = tickets === 'error' ? true : false;

	$: ticketError && errToast('Could not load open tickets, please try again or contact BTC Map.');

	const totalTickets = add.length + verify.length;
</script>

<section id="tickets">
	<div class="w-full rounded-3xl border border-statBorder dark:bg-white/10">
		<div class="p-5 text-lg font-semibold text-primary dark:text-white">
			<h3 class="mb-2 text-center md:text-left">
				{name || 'BTC Map Area'} Tickets
				{#if filteredTickets.length && !ticketError}
					<span class="text-base">({totalTickets})</span>
				{/if}
				<InfoTooltip
					tooltip="Tickets up for grabs from our noob forms! Anybody can help add or verify submissions on OpenStreetMap."
				/>
			</h3>

			{#each ticketTypes as type}
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

			{#if filteredTickets?.length === 100}
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