<script lang="ts">
import AreaStatsSection from "$components/area/AreaStatsSection.svelte";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();
</script>

<AreaStatsSection {data} />
