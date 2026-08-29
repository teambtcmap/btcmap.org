<script lang="ts">
import { onDestroy } from "svelte";

import Icon from "$components/Icon.svelte";

type Props = {
	value: string;
	// Icon edge length in px. The drawer needs a much smaller mark than the
	// invoice/donation call-outs this component was originally built for.
	size?: string;
	// Accessible name, also used as the hover tooltip. Icon-only buttons have
	// no text content, so without this the button is unnamed for screen readers.
	label?: string;
	// Announced/shown in place of `label` while the copy confirmation is up.
	copiedLabel?: string;
	iconType?: "fa" | "material";
	class?: string;
};

let {
	value,
	size = "24",
	label = undefined,
	copiedLabel = undefined,
	iconType = "fa",
	class: className = "text-link transition-colors hover:text-hover",
}: Props = $props();

let copied = $state(false);
let resetTimeout: ReturnType<typeof setTimeout> | undefined;

const copy = async (field: string) => {
	let success = false;
	try {
		await navigator.clipboard.writeText(field);
		success = true;
	} catch {
		// fallback for browsers/contexts where clipboard API is unavailable
		const el = document.createElement("textarea");
		el.value = field;
		el.style.position = "fixed";
		el.style.opacity = "0";
		document.body.appendChild(el);
		el.focus();
		el.select();
		success = document.execCommand("copy");
		document.body.removeChild(el);
	}
	if (success) {
		copied = true;
		clearTimeout(resetTimeout);
		resetTimeout = setTimeout(() => (copied = false), 2100);
	}
};

onDestroy(() => clearTimeout(resetTimeout));
</script>

<button
	type="button"
	class={className}
	aria-label={copied ? (copiedLabel ?? label) : label}
	title={copied ? (copiedLabel ?? label) : label}
	onclick={() => copy(value)}
>
	{#if copied}
		<Icon type={iconType} icon="check" w={size} h={size} />
	{:else}
		<Icon type={iconType} icon={iconType === 'material' ? 'content_copy' : 'clipboard'} w={size} h={size} />
	{/if}
</button>
