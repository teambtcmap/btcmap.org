<script lang="ts">
// The bespoke placement-mode pin (bitcoin-orange, white outline + dot):
// the map's placement crosshair, echoed on /add-location's arrival banner
// so the handed-over pin reads as the same object. Inline SVG rather than
// <Icon>: the glyph is custom (not in any Iconify set) and must paint on
// first render without an Iconify API fetch.
type Props = {
	width?: number;
	class?: string;
};

let { width = 24, class: className = "" }: Props = $props();

// 24x30 viewBox — derived height keeps the pin's 4:5 aspect.
const height = $derived((width * 30) / 24);
</script>

<svg {width} {height} viewBox="0 0 24 30" class={className} aria-hidden="true">
	<path
		d="M12 29s9-11.5 9-18A9 9 0 103 11c0 6.5 9 18 9 18z"
		fill="#F7931A"
		stroke="#fff"
		stroke-width="1.6"
	/>
	<circle cx="12" cy="11" r="4.6" fill="#fff" />
</svg>
