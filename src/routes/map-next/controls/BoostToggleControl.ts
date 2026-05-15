import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";

// Mirrors /map's BoostControl (MapControls.svelte:20-81): a single
// ctrl-group with one anchor that toggles the `?boosts=true` URL param.
// Click triggers a full page reload via `location.search = …`, matching
// /map's behavior — no live URL listener needed.
export class BoostToggleControl implements IControl {
	#container: HTMLDivElement | undefined;

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const t = get(_);
		const label = t("boost.locations");

		const boostsActive =
			typeof window !== "undefined" &&
			new URLSearchParams(window.location.search).has("boosts");

		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = "#";
		a.tabIndex = 0;
		a.title = label;
		a.setAttribute("role", "button");
		a.setAttribute("aria-label", label);
		a.setAttribute("aria-disabled", "false");

		const img = document.createElement("img");
		img.src = boostsActive ? "/icons/boost-solid.svg" : "/icons/boost.svg";
		img.alt = t("mapControls.boostAlt");
		img.width = 16;
		img.height = 16;
		a.appendChild(img);

		a.addEventListener("click", (e) => {
			e.preventDefault();
			trackEvent("boost_layer_toggle");
			const currentUrl = new URL(window.location.href);
			if (currentUrl.searchParams.has("boosts")) {
				currentUrl.searchParams.delete("boosts");
			} else {
				currentUrl.searchParams.set("boosts", "true");
			}
			window.location.search = currentUrl.search;
		});

		container.appendChild(a);
		this.#container = container;
		return container;
	}

	onRemove(): void {
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}
}
