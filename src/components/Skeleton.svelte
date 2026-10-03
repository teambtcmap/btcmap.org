<script lang="ts">
// One pulsing loading placeholder (#1487). Size, rounding and layout come in
// through `class`; the tint is fixed here, one for light and one for dark,
// so every skeleton matches. Don't pass a bg-* in `class`: without
// tailwind-merge it wouldn't reliably win.
// aria-hidden: an empty block has nothing to say, the loading area does.
type Props = {
	class?: string;
	as?: "div" | "span";
};

let { class: className = "", as = "div" }: Props = $props();
</script>

<svelte:element this={as} aria-hidden="true" class="animate-pulse bg-link/50 dark:bg-white/10 {className}"></svelte:element>
