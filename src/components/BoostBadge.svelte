<script lang="ts">
import { _ } from "svelte-i18n";

import Icon from "$components/Icon.svelte";
</script>

<span class="flex items-center gap-1 rounded-full bg-bitcoin/10 px-2 py-0.5 text-xs text-bitcoin">
	<Icon w="12" h="12" icon="arrow_circle_up" type="material" />
	{$_('boost.boosted')}
</span>
