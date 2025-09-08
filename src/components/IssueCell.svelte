<script lang="ts">
	import { IssueIcon } from '$lib/comp';

	export let id: 'icon' | 'name' | 'type' | 'viewLink' | 'editLink' | 'helpLink';
	export let value: string;
</script>

{#if id === 'icon'}
	<IssueIcon icon={value} />
{:else if id === 'name'}
	{value}
{:else if id === 'type'}
	{value}
{:else if id === 'viewLink'}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a
		href="https://www.openstreetmap.org/{value}"
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		View
	</a>
{:else if id === 'editLink'}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a
		href="https://www.openstreetmap.org/edit?{value}"
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		Edit
	</a>
{:else if id === 'helpLink' && value}
	<a
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		href={value}
		target="_blank"
		rel="noreferrer"
		class="text-link transition-colors hover:text-hover"
	>
		Help
	</a>
{/if}
