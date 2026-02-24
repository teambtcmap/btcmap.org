<script lang="ts">
import type { Control, Map } from "leaflet";
import { onDestroy, onMount } from "svelte";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import { dataRefresh, homeMarkerButtons } from "$lib/map/setup";
import type { Leaflet } from "$lib/types";

import { browser } from "$app/environment";
import { page } from "$app/stores";

export let map: Map | undefined;
export let leaflet: Leaflet | undefined;
export let DomEvent: typeof import("leaflet/src/dom/DomEvent") | undefined;

let boostControl: Control | null = null;

const addBoostControl = () => {
	if (!leaflet || !map) return;

	const BoostControl = leaflet.Control.extend({
		options: {
			position: "topright",
		},
		onAdd: () => {
			const addControlDiv = leaflet.DomUtil.create("div");
			addControlDiv.classList.add(
				"leaflet-control-boost",
				"leaflet-bar",
				"leaflet-control",
			);

			const boostLabel = get(_)("boost.locations");
			const boostLayerButton = leaflet.DomUtil.create("a");
			boostLayerButton.classList.add("leaflet-control-boost-layer");
			boostLayerButton.href = "#";
			boostLayerButton.tabIndex = 0;
			boostLayerButton.title = boostLabel;
			boostLayerButton.role = "button";
			boostLayerButton.ariaLabel = boostLabel;
			boostLayerButton.ariaDisabled = "false";
			boostLayerButton.innerHTML = `<img src='${$page.url.searchParams.has("boosts") ? "/icons/boost-solid.svg" : "/icons/boost.svg"}' alt='boost' id='boost-layer' style='width: 16px; height: 16px;'/>`;
			boostLayerButton.onclick = (e) => {
				e.preventDefault();
				trackEvent("boost_layer_toggle");
				const currentUrl = new URL($page.url);
				const boosts = currentUrl.searchParams.has("boosts");
				if (boosts) {
					currentUrl.searchParams.delete("boosts");
				} else {
					currentUrl.searchParams.set("boosts", "true");
				}
				location.search = currentUrl.search;
			};
			addControlDiv.append(boostLayerButton);

			return addControlDiv;
		},
	});

	boostControl = new BoostControl();
	map.addControl(boostControl);

	const boostLayer = document.querySelector(".leaflet-control-boost-layer");
	if (boostLayer && DomEvent) {
		DomEvent.disableClickPropagation(boostLayer as HTMLElement);
	}
};

onMount(() => {
	if (!browser || !map || !leaflet || !DomEvent) return;

	const t = get(_);
	const mapControlsT = {
		goToHome: t("mapControls.goToHome"),
		addLocation: t("mapControls.addLocation"),
		communityMap: t("mapControls.communityMap"),
		merchantMap: t("mapControls.merchantMap"),
		dataRefreshAvailable: t("mapControls.dataRefreshAvailable"),
	};

	addBoostControl();
	homeMarkerButtons(leaflet, map, DomEvent, true, mapControlsT);
	dataRefresh(leaflet, map, DomEvent, mapControlsT);
});

onDestroy(() => {
	if (map && boostControl) {
		map.removeControl(boostControl);
	}
});
</script>
