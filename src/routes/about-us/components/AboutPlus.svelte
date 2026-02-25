<script lang="ts">
import Icon from "$components/Icon.svelte";
import { _ } from "$lib/i18n";
</script>

<div class="space-y-2">
	<div class="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-link">
		<Icon type="fa" icon="circle-plus" w="40" h="40" class="text-white" />
	</div>

	<p class="text-center font-semibold">{$_("aboutUs.integrations.more")}</p>
</div>
