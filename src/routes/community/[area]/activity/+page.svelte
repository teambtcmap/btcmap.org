<script lang="ts">
import AreaActivitySection from "$components/area/AreaActivitySection.svelte";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();
</script>

<AreaActivitySection {data} />
