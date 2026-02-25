<script lang="ts">
import { _ } from "svelte-i18n";

import IssueIcon from "$components/IssueIcon.svelte";

export let id: "icon" | "name" | "type" | "viewLink" | "editLink" | "helpLink";
export let value: string;
</script>

{#if id === 'icon'}
	<IssueIcon icon={value} />
{:else if id === 'name'}
	{value}
{:else if id === 'type'}
	{value}
{:else if id === 'viewLink'}
	<a
		href="https://www.openstreetmap.org/{value}"
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		{$_(`maintain.view`)}
	</a>
{:else if id === 'editLink'}
	<a
		href="https://www.openstreetmap.org/edit?{value}"
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		{$_(`maintain.edit`)}
	</a>
{:else if id === 'helpLink' && value}
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={value}
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{$_(`maintain.help`)}
	</a>
{/if}
