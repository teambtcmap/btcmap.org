<script lang="ts">
	import { IssueIcon } from '$lib/comp';
	import type { Issue } from '$lib/types';
	import { getIssueHelpLink, getIssueIcon } from '$lib/utils';

	export let issues: Issue[];
</script>

<div class="space-y-2 text-primary dark:text-white">
	{#if issues.length}
		{#each issues as issue, index (index)}
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
