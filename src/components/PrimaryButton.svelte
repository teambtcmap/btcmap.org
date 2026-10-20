<script lang="ts">
import type { Snippet } from "svelte";
import type {
	HTMLAnchorAttributes,
	HTMLButtonAttributes,
} from "svelte/elements";

import LoadingSpinner from "$components/LoadingSpinner.svelte";

// The rest flows to whichever element renders, so it takes the attributes
// both share.
type Rest = Omit<
	HTMLButtonAttributes & HTMLAnchorAttributes,
	"style" | "type" | "disabled" | "onclick" | "children"
>;
type Props = Rest & {
	style: string;
	link?: string;
	type?: "button" | "submit";
	external?: boolean;
	disabled?: boolean;
	// Shows the spinner in place of the label; implies `busy`.
	loading?: boolean;
	// Something is running: the button blocks clicks but stays focusable
	// (#1548). A focused button that turns `disabled` drops focus to
	// <body>, so a screen reader hears nothing during the request, and a
	// failure toast has no place to land next to.
	busy?: boolean;
	onclick?: (event: MouseEvent) => void;
	children?: Snippet;
};
let {
	style,
	link,
	type,
	external,
	disabled,
	loading,
	busy,
	onclick,
	children,
	...rest
}: Props = $props();

const baseStyles =
	"block bg-link text-center font-semibold text-white hover:bg-hover transition-colors";

const combinedStyles = $derived(`${baseStyles} ${style}`);
const isBusy = $derived(loading || busy);

// Swallowing the click also stops the form's implicit submission (Enter
// in a field), which the browser delivers as a click on this button.
const handleClick = (event: MouseEvent) => {
	if (isBusy) {
		event.preventDefault();
		return;
	}
	onclick?.(event);
};
</script>

{#if link}
	<a
		href={link}
		target={external ? '_blank' : undefined}
		rel={external ? 'noopener noreferrer' : undefined}
		class={combinedStyles}
		{onclick}
		{...rest}
	>
		{@render children?.()}
	</a>
{:else}
	<button
		onclick={handleClick}
		{type}
		disabled={disabled && !isBusy}
		aria-disabled={isBusy ? 'true' : undefined}
		class={combinedStyles}
		{...rest}
	>
		{#if loading}
			<!-- The label stays the button's name while the spinner shows. -->
			<span class="sr-only">{@render children?.()}</span>
			<LoadingSpinner />
		{:else}
			{@render children?.()}
		{/if}
	</button>
{/if}
