<script lang="ts">
export let text: string;

const NAMED_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": "\"",
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

let decodedText = "";
$: decodedText = decodeHtmlEntities(text);
</script>

<p class="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
	{decodedText}
</p>