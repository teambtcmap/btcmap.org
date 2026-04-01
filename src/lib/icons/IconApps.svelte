<script lang="ts">
import android from "./apps/android.svg?raw";
import apk from "./apps/apk.svg?raw";
import appStore from "./apps/app-store.svg?raw";
import fdroid from "./apps/f-droid.svg?raw";
import googlePlay from "./apps/google-play.svg?raw";
import ios from "./apps/ios.svg?raw";
import linuxPackage from "./apps/linux-package.svg?raw";
import obtainium from "./apps/obtainium.svg?raw";
import play from "./apps/play.svg?raw";
import web from "./apps/web.svg?raw";
import zapstore from "./apps/zapstore.svg?raw";
import type { AppIconName } from "./types";

const icons: Record<AppIconName, string> = {
	android,
	apk,
	"app-store": appStore,
	"f-droid": fdroid,
	"google-play": googlePlay,
	ios,
	"linux-package": linuxPackage,
	obtainium,
	play,
	web,
	zapstore,
};

export let icon: AppIconName;
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
	{@html icons[icon]}
</span>

<style>
	span :global(svg) {
		width: 100%;
		height: 100%;
	}
</style>
