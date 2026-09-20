<script lang="ts">
import Icon from "$components/Icon.svelte";

// The forms' one hint paragraph. Locale files write diacritics as HTML
// entities (&uuml;, &eacute;, …), so every hint decodes them here rather
// than at each call site. `id` ties the hint to its control through
// aria-describedby; `icon` fronts it with a material glyph, for a hint
// that reports an outcome rather than offering a passive note.
type Props = {
	text: string;
	id?: string;
	icon?: string;
};
let { text, id, icon }: Props = $props();

const NAMED_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&apos;": "'",
	"&nbsp;": " ",
	"&mdash;": "—",
	"&euml;": "ë",
	"&ouml;": "ö",
	"&uuml;": "ü",
	"&eacute;": "é",
};

const decodeHtmlEntities = (value: string): string =>
	value
		.replace(/&#(\d+);/g, (_match, dec) => String.fromCodePoint(Number(dec)))
		.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&[a-zA-Z]+?;/g, (match) => NAMED_ENTITIES[match] ?? match);

const decodedText = $derived(decodeHtmlEntities(text));
</script>

<p
	{id}
	class="mt-1 text-sm text-neutral-500 dark:text-neutral-400 {icon
		? 'flex gap-1.5'
		: ''}"
>
	{#if icon}
		<Icon type="material" {icon} w="16" h="16" class="mt-0.5 shrink-0" />
	{/if}
	<span>{decodedText}</span>
</p>
