<script lang="ts">
import AreaEventsSection from "$components/area/AreaEventsSection.svelte";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();
</script>

<AreaEventsSection {data} />
