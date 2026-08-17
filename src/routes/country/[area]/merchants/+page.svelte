<script lang="ts">
import AreaMerchantsSection from "$components/area/AreaMerchantsSection.svelte";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();
</script>

<AreaMerchantsSection {data} />
