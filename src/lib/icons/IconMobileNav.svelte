<script lang="ts">
import activity from "./mobile-nav/activity.svg?raw";
import add from "./mobile-nav/add.svg?raw";
import api from "./mobile-nav/api.svg?raw";
import apps from "./mobile-nav/apps.svg?raw";
import areas from "./mobile-nav/areas.svg?raw";
import areasHighlight from "./mobile-nav/areas-highlight.svg?raw";
import bars from "./mobile-nav/bars.svg?raw";
import close from "./mobile-nav/close.svg?raw";
import communities from "./mobile-nav/communities.svg?raw";
import contribute from "./mobile-nav/contribute.svg?raw";
import contributeHighlight from "./mobile-nav/contribute-highlight.svg?raw";
import countries from "./mobile-nav/countries.svg?raw";
import dash from "./mobile-nav/dash.svg?raw";
import directory from "./mobile-nav/directory.svg?raw";
import general from "./mobile-nav/general.svg?raw";
import issue from "./mobile-nav/issue.svg?raw";
import leader from "./mobile-nav/leader.svg?raw";
import map from "./mobile-nav/map.svg?raw";
import mapHighlight from "./mobile-nav/map-highlight.svg?raw";
import stats from "./mobile-nav/stats.svg?raw";
import statsHighlight from "./mobile-nav/stats-highlight.svg?raw";
import support from "./mobile-nav/support.svg?raw";
import ticket from "./mobile-nav/ticket.svg?raw";
import verify from "./mobile-nav/verify.svg?raw";
import wiki from "./mobile-nav/wiki.svg?raw";
import wikiHighlight from "./mobile-nav/wiki-highlight.svg?raw";
import type { MobileNavIconName } from "./types";

const icons: Record<MobileNavIconName, string> = {
	activity,
	add,
	api,
	apps,
	"areas-highlight": areasHighlight,
	areas,
	bars,
	close,
	communities,
	"contribute-highlight": contributeHighlight,
	contribute,
	countries,
	dash,
	directory,
	general,
	issue,
	leader,
	"map-highlight": mapHighlight,
	map,
	"stats-highlight": statsHighlight,
	stats,
	support,
	ticket,
	verify,
	"wiki-highlight": wikiHighlight,
	wiki,
};

export let icon: MobileNavIconName;
export let w = "24";
export let h = "24";
let className: string | undefined = undefined;
export { className as class };
</script>

<span
	class={className}
	style="display: block; width: {w}px; height: {h}px;"
	role="img"
	aria-hidden="true"
>
	<!-- eslint-disable-next-line svelte/no-at-html-tags - SVG from trusted local files -->
	{@html icons[icon]}
</span>

<style>
	span :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
