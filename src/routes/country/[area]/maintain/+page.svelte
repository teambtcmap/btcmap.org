<script lang="ts">
import AreaMaintainSection from "$components/area/AreaMaintainSection.svelte";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();
</script>

<AreaMaintainSection {data} />
