<script lang="ts">
// One pulsing loading placeholder (#1487). Size, rounding and layout come in
// through `class`; the tint lives here so skeletons stay consistent. A tint
// in `class` wouldn't reliably win (no tailwind-merge), so it's `tone`.
// aria-hidden: an empty block has nothing to say, the loading area does.
type Props = {
	class?: string;
	as?: "div" | "span";
	tone?: "default" | "subtle";
};

let { class: className = "", as = "div", tone = "default" }: Props = $props();

const TONES = {
	default: "bg-link/50",
	subtle: "bg-link/20",
} as const;
</script>

<svelte:element this={as} aria-hidden="true" class="animate-pulse {TONES[tone]} {className}"></svelte:element>
