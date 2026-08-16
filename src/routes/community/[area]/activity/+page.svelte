<script lang="ts">
import AreaActivity from "$components/area/AreaActivity.svelte";
import { getAreaSectionContext } from "$lib/area/sectionContext";

import type { PageProps } from "./$types";

let { data }: PageProps = $props();

const {
	taggers,
	taggersLoaded,
	taggersInFlight,
	taggersLoadError,
	ensureTaggers,
} = getAreaSectionContext();

// Reactive, not onMount: on an X/activity → Y/activity navigation this
// page instance is REUSED (same route id), so onMount never re-fires.
// The layout's area reset clears the flags, which re-runs this effect —
// replicating the old activeSection-gated reactive exactly. Effects
// never run during SSR, so no browser guard is needed.
$effect(() => {
	if (!$taggersLoaded && !$taggersInFlight) ensureTaggers();
});
</script>

<!-- Area data is SSR-delivered now, so it is initialized by definition; the prop survives until AreaFeed drops its gate. -->
<AreaActivity
	alias={data.id}
	name={data.name}
	dataInitialized={true}
	taggersLoaded={$taggersLoaded}
	taggers={$taggers}
	taggersLoadError={$taggersLoadError}
/>
