<script lang="ts">
import { _ } from "svelte-i18n";

import AreaTickets from "$components/area/AreaTickets.svelte";
import VerifyCommunityForm from "$components/area/VerifyCommunityForm.svelte";
import IssuesTable from "$components/IssuesTable.svelte";

let { data } = $props();
</script>

<IssuesTable
	title={$_('area.taggingIssues', { values: { name: data.name || $_('area.defaultName') } })}
	issues={data.issues ?? []}
	loading={false}
/>
<AreaTickets
	tickets={data.tickets}
	title={$_('area.openTickets', { values: { name: data.name || $_('area.defaultName') } })}
/>
<div
	id="verify-form"
	class="mx-auto w-full max-w-[1000px] rounded-3xl border border-link/25 p-8 xl:w-[1000px]"
>
	<VerifyCommunityForm communityName={data.name} communityAlias={data.id} />
</div>
