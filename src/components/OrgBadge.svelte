<script lang="ts">
import { _ } from "$lib/i18n";

export let org: string;

$: organizations = org
	? org
			.split(",")
			.map((o) => o.trim())
			.filter((o) => o.length > 0)
	: [];
</script>

{#if organizations.length > 0}
	<div class="mx-auto flex flex-wrap justify-center gap-1">
		{#each organizations as organization (organization)}
			<p
				class="w-fit rounded-full bg-[#10B981] px-3.5 py-1 text-xs font-semibold whitespace-nowrap text-white uppercase"
				title={$_('communityMap.organization')}
			>
				{organization}
			</p>
		{/each}
	</div>
{/if}
