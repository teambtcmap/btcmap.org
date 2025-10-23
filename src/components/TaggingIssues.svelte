<script lang="ts">
	import { CloseButton, IssueIcon } from '$lib/comp';
	import { taggingIssues } from '$lib/store';
	import { getIssueHelpLink, getIssueIcon } from '$lib/utils';
	import OutClick from 'svelte-outclick';
	import { fly } from 'svelte/transition';

	const closeModal = () => ($taggingIssues = undefined);
</script>

{#if $taggingIssues}
	<OutClick excludeQuerySelectorAll="#tagging-issues" on:outclick={closeModal}>
		<div
			transition:fly={{ y: 200, duration: 300 }}
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-gray-300 dark:border-white/95 bg-white p-6 text-left shadow-2xl md:h-[400px] md:w-[430px] dark:bg-dark"
		>
			<CloseButton on:click={closeModal} />

			<div class="space-y-2 text-primary dark:text-white">
				{#if $taggingIssues.length}
					{#each $taggingIssues as issue, index (index)}
						<div class="flex items-center space-x-2">
							<IssueIcon icon={getIssueIcon(issue.type)} />
							<p>{issue.description}</p>
							{#if getIssueHelpLink(issue.type)}
								<!-- eslint-disable svelte/no-navigation-without-resolve -->
								<a
									href={getIssueHelpLink(issue.type)}
									target="_blank"
									rel="noreferrer"
									class="text-link transition-colors hover:text-hover"
								>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
									Help
								</a>
							{/if}
						</div>
					{/each}
				{:else}
					<div class="flex items-center space-x-2">
						<i class="fa-solid fa-thumbs-up w-3" />
						<p>No tagging issues!</p>
					</div>
				{/if}
			</div>
		</div>
	</OutClick>
{/if}
