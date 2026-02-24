<script lang="ts">
import LoadingIndicator from "$components/LoadingIndicator.svelte";

export let visible = false;
</script>

<LoadingIndicator {visible} status="Loading tiles..." />
