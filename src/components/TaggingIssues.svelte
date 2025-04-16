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
			class="center-fixed z-[2000] max-h-[90vh] w-[90vw] overflow-auto rounded-xl border border-mapBorder bg-white p-6 text-left shadow-2xl dark:bg-dark md:h-[400px] md:w-[430px]"
		>
			<CloseButton
				position="flex justify-end"
				click={closeModal}
				colors="text-primary dark:text-white dark:hover:text-white/80 hover:text-link"
			/>
			<div class="space-y-2 text-primary dark:text-white">
				{#if $taggingIssues.length}
					{#each $taggingIssues as issue (issue)}
						<div class="flex items-center space-x-2">
							<IssueIcon icon={getIssueIcon(issue.type)} />
							<p>{issue.description}</p>
							{#if getIssueHelpLink(issue.type)}
								<a
									href={getIssueHelpLink(issue.type)}
									target="_blank"
									rel="noreferrer"
									class="text-link transition-colors hover:text-hover"
								>
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
