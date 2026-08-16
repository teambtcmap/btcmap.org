<script lang="ts">
import { _ } from "svelte-i18n";

import AreaTickets from "$components/area/AreaTickets.svelte";
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
