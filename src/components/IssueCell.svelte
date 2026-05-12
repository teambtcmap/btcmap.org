<script lang="ts">
import { _ } from "svelte-i18n";

import IssueIcon from "$components/IssueIcon.svelte";
import TextLink from "$components/TextLink.svelte";

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
	<TextLink link="https://www.openstreetmap.org/{value}" external>
		{$_(`maintain.view`)}
	</TextLink>
{:else if id === 'editLink'}
	<TextLink link="https://www.openstreetmap.org/edit?{value}" external>
		{$_(`maintain.edit`)}
	</TextLink>
{:else if id === 'helpLink' && value}
	<TextLink link={value} external>
		{$_(`maintain.help`)}
	</TextLink>
{/if}
