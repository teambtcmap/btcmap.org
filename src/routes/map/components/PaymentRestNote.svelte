<script lang="ts">
import { _ } from "$lib/i18n";

// The payment empty-state message on a resting surface (#1427): the mobile
// peek and the desktop floating bar both carry it, so the markup lives in
// one place. The string is the one #1424 already wrote and translated —
// this adds no wording, only a second place the same sentence can be read.
//
// role="status" matches the panel's own empty-state containers: the note
// appears once the enrichment resolves the filter, which is after the
// surface is on screen, so its arrival has to be announced rather than
// silently swapped in.
type Props = {
	count: number;
};
let { count }: Props = $props();
</script>

<p role="status" class="text-sm text-body dark:text-white/70">
	{$_('search.noPaymentRecorded', { values: { count } })}
</p>
