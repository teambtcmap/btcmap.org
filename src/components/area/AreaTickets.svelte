<script lang="ts">
import InfoTooltip from "$components/InfoTooltip.svelte";
import OpenTicket from "$components/OpenTicket.svelte";
import { GITEA_LABELS } from "$lib/constants";
import { _ } from "$lib/i18n";
import type { GiteaIssue, GiteaLabel } from "$lib/types";
import type { Tickets } from "$lib/types.js";
import { errToast } from "$lib/utils";

export let title: string;
export let tickets: Tickets;

$: filteredTickets =
	tickets === "error" || tickets === "maintenance" ? [] : tickets;

$: add = filteredTickets.filter((issue: GiteaIssue) =>
	issue.labels.some(
		(label: GiteaLabel) => label.id === GITEA_LABELS.DATA.ADD_LOCATION,
	),
);
$: verify = filteredTickets.filter((issue: GiteaIssue) =>
	issue.labels.some(
		(label: GiteaLabel) => label.id === GITEA_LABELS.DATA.VERIFY_LOCATION,
	),
);
$: community = filteredTickets.filter((issue: GiteaIssue) =>
	issue.labels.some(
		(label: GiteaLabel) => label.id === GITEA_LABELS.DATA.COMMUNITY_SUBMISSION,
	),
);

$: ticketTypes = [
	$_("areaTickets.typeAdd"),
	$_("areaTickets.typeVerify"),
	$_("areaTickets.typeCommunity"),
];
let showType = 0;

$: ticketError = tickets === "error";
$: ticketMaintenance = tickets === "maintenance";

$: if (ticketError) {
	errToast($_("areaTickets.loadError"));
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
					tooltip={$_("areaTickets.tooltip")}
				/>
			</h3>

			<div role="tablist" class="flex flex-col md:flex-row md:inline">
				{#each ticketTypes as type, i (i)}
					<button
						role="tab"
						aria-selected={showType === i}
						aria-disabled={!filteredTickets.length || ticketError || ticketMaintenance}
						class="mx-auto block w-40 border border-link py-2 text-center md:inline {i === 0
							? 'rounded-t md:rounded-l md:rounded-tr-none'
							: i === 2
								? 'rounded-b md:rounded-r md:rounded-bl-none'
								: ''} {showType === i ? 'bg-link text-white' : ''} transition-colors"
						on:click={() => (showType = i)}
						disabled={!filteredTickets.length || ticketError || ticketMaintenance}
					>
						{type}
					</button>
				{/each}
			</div>
		</div>

		{#if filteredTickets.length && !ticketError}
			{#if showType === 0}
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
						{$_("areaTickets.noAddTickets")}
					</p>
				{/if}
			{:else if showType === 1}
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
						{$_("areaTickets.noVerifyTickets")}
					</p>
				{/if}
			{:else if showType === 2}
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
						{$_("areaTickets.noCommunityTickets")}
					</p>
				{/if}
			{/if}
		{:else if ticketMaintenance}
			<p
				class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
			>
				{$_("areaTickets.maintenanceMessage")}<a
					href="https://gitea.btcmap.org/teambtcmap/btcmap-data/issues"
					target="_blank"
					rel="noreferrer"
					class="text-link transition-colors hover:text-hover">{$_("areaTickets.viewOnGitea")}</a
				>.
			</p>
		{:else if ticketError}
			<p
				class="border-t border-gray-300 p-5 text-center text-body dark:border-white/95 dark:text-white"
			>
				{$_("areaTickets.errorMessage")}
			</p>
		{/if}
	</div>
</section>
