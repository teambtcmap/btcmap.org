<script lang="ts">
import LoadingIndicator from "$components/LoadingIndicator.svelte";
import { _ } from "$lib/i18n";

export let visible = false;
</script>

<LoadingIndicator {visible} status={$_("status.loadingTiles")} />
