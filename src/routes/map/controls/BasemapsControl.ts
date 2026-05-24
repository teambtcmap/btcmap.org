import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { _ } from "$lib/i18n";
import {
	BASEMAP_STORAGE_KEY,
	type BasemapId,
	isBasemapId,
} from "$lib/map/basemaps";

type BasemapEntry = { id: BasemapId; label: string };

type Options = {
	basemaps: BasemapEntry[];
	initial: BasemapId;
};

// Layer-picker control with the same shape as Leaflet's L.control.layers
// that prod /map uses: a single icon button that expands into a radio
// list of basemap labels. The three basemap layers are declared in the
// initial style spec; this control only toggles their `visibility` and
// persists the active selection so it survives reloads.
export class BasemapsControl implements IControl {
	#options: Options;
	#map: MapLibreMap | undefined;
	#container: HTMLDivElement | undefined;
	#button: HTMLAnchorElement | undefined;
	#popup: HTMLDivElement | undefined;
	#current: BasemapId;
	#unsubLocale: (() => void) | null = null;
	#docClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(options: Options) {
		this.#options = options;
		this.#current = options.initial;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(map: MapLibreMap): HTMLElement {
		this.#map = map;

		const container = document.createElement("div");
		container.className =
			"maplibregl-ctrl maplibregl-ctrl-group maplibre-next-basemaps";

		// Toggle button — anchor styled like the other action controls.
		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "true");
		button.setAttribute("aria-expanded", "false");

		// Inline SVG: stack-of-layers icon (Material `layers-outline`).
		// Inline rather than fetched so the button renders the moment the
		// control is added — no flash, no extra request.
		button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;

		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#toggle();
		});
		container.appendChild(button);

		// Popup with one labelled radio per basemap. Hidden until toggled.
		const popup = document.createElement("div");
		popup.className = "maplibre-next-basemaps-popup";
		popup.setAttribute("role", "radiogroup");
		popup.hidden = true;
		container.appendChild(popup);

		this.#container = container;
		this.#button = button;
		this.#popup = popup;

		this.#renderPopup();

		// Re-render labels when the locale changes.
		this.#unsubLocale = _.subscribe(() => this.#renderPopup());

		// Click anywhere outside the control closes the popup.
		this.#docClickHandler = (e) => {
			if (!this.#container?.contains(e.target as Node)) this.#close();
		};
		document.addEventListener("click", this.#docClickHandler);

		return container;
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		if (this.#docClickHandler) {
			document.removeEventListener("click", this.#docClickHandler);
			this.#docClickHandler = null;
		}
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
		this.#button = undefined;
		this.#popup = undefined;
		this.#map = undefined;
	}

	#renderPopup(): void {
		if (!this.#popup) return;
		this.#popup.innerHTML = "";
		const groupName = `maplibre-next-basemap-${Math.random().toString(36).slice(2, 8)}`;
		for (const bm of this.#options.basemaps) {
			const label = document.createElement("label");
			label.className = "maplibre-next-basemaps-option";

			const radio = document.createElement("input");
			radio.type = "radio";
			radio.name = groupName;
			radio.value = bm.id;
			radio.checked = bm.id === this.#current;
			radio.addEventListener("change", () => {
				if (radio.checked) this.#select(bm.id);
			});

			const text = document.createElement("span");
			text.textContent = bm.label;

			label.appendChild(radio);
			label.appendChild(text);
			this.#popup.appendChild(label);
		}

		const title = get(_)("mapControls.basemapTitle", {
			default: "Basemap",
		});
		this.#button?.setAttribute("title", title);
		this.#button?.setAttribute("aria-label", title);
	}

	#select(id: BasemapId): void {
		if (!this.#map) return;
		if (id === this.#current) {
			this.#close();
			return;
		}
		// Toggle visibility on the pre-declared raster layers.
		for (const bm of this.#options.basemaps) {
			this.#map.setLayoutProperty(
				bm.id,
				"visibility",
				bm.id === id ? "visible" : "none",
			);
		}
		this.#current = id;
		try {
			if (isBasemapId(id)) localStorage.setItem(BASEMAP_STORAGE_KEY, id);
		} catch {
			// localStorage unavailable; skip persistence
		}
		this.#close();
	}

	#toggle(): void {
		if (!this.#popup) return;
		if (this.#popup.hidden) this.#open();
		else this.#close();
	}

	#open(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = false;
		this.#button.setAttribute("aria-expanded", "true");
	}

	#close(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = true;
		this.#button.setAttribute("aria-expanded", "false");
	}
}
