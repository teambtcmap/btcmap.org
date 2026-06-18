<script lang="ts">
import LoadingIndicator from "$components/LoadingIndicator.svelte";
import { _ } from "$lib/i18n";

export let visible = false;
</script>

<!-- On mobile, lift above the anchored search sheet's 72px peek so it isn't
     covered (desktop keeps the default bottom-left position). -->
<LoadingIndicator
	{visible}
	status={$_("status.loadingTiles")}
	positionClass="bottom-[calc(env(safe-area-inset-bottom)+6rem)] left-2 md:bottom-8 md:left-4"
/>
