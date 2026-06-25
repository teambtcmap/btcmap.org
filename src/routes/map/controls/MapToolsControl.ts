import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _ } from "$lib/i18n";
import {
	BASEMAP_STORAGE_KEY,
	type BasemapId,
	isBasemapId,
} from "$lib/map/basemaps";

import "./controls.css";

type BasemapEntry = { id: BasemapId; label: string };

export type MapToolsOptions = {
	basemap?: {
		basemaps: BasemapEntry[];
		initial: BasemapId;
		onSelect: (id: BasemapId) => void;
	};
};

// One button that expands a sectioned panel consolidating the map's
// display controls (basemap; verified filter, overlays and view added in
// later tasks). Replaces the previously separate BasemapsControl /
// VerifiedFilterControl / BoostToggleControl / HeatmapToggleControl.
// Each section is optional so /communities/map can mount basemap-only and
// get exactly the old BasemapsControl behaviour. The page owns the actual
// map effects via the per-section callbacks.
export class MapToolsControl implements IControl {
	#options: MapToolsOptions;
	#container: HTMLDivElement | undefined;
	#button: HTMLAnchorElement | undefined;
	#popup: HTMLDivElement | undefined;
	#currentBasemap: BasemapId | undefined;
	#unsubLocale: (() => void) | null = null;
	#docClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(options: MapToolsOptions) {
		this.#options = options;
		this.#currentBasemap = options.basemap?.initial;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className =
			"maplibregl-ctrl maplibregl-ctrl-group maplibre-next-tools";

		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "true");
		button.setAttribute("aria-expanded", "false");
		// Layers-stack glyph (same as the old BasemapsControl).
		button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;
		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#toggle();
		});
		container.appendChild(button);

		const popup = document.createElement("div");
		popup.className = "maplibre-next-basemaps-popup maplibre-next-tools-popup";
		popup.hidden = true;
		container.appendChild(popup);

		this.#container = container;
		this.#button = button;
		this.#popup = popup;

		this.#renderPanel();
		this.#updateActiveDot();

		this.#unsubLocale = _.subscribe(() => this.#renderPanel());

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
	}

	#renderPanel(): void {
		if (!this.#popup) return;
		this.#popup.innerHTML = "";
		const t = get(_);

		if (this.#options.basemap) {
			this.#popup.appendChild(
				this.#renderSectionHeader(t("mapControls.basemapTitle")),
			);
			this.#popup.appendChild(this.#renderBasemapSection());
		}

		const title = t("mapControls.layersAndFilters");
		this.#button?.setAttribute("title", title);
		this.#button?.setAttribute("aria-label", title);
	}

	#renderSectionHeader(text: string): HTMLElement {
		const h = document.createElement("div");
		h.className = "maplibre-next-tools-header";
		h.textContent = text;
		return h;
	}

	#renderBasemapSection(): HTMLElement {
		const group = document.createElement("div");
		group.setAttribute("role", "radiogroup");
		const cfg = this.#options.basemap;
		if (!cfg) return group;
		const groupName = `maplibre-next-basemap-${Math.random().toString(36).slice(2, 8)}`;
		for (const bm of cfg.basemaps) {
			const label = document.createElement("label");
			label.className = "maplibre-next-basemaps-option";
			const radio = document.createElement("input");
			radio.type = "radio";
			radio.name = groupName;
			radio.value = bm.id;
			radio.checked = bm.id === this.#currentBasemap;
			radio.addEventListener("change", () => {
				if (radio.checked) this.#selectBasemap(bm.id);
			});
			const text = document.createElement("span");
			text.textContent = bm.label;
			label.appendChild(radio);
			label.appendChild(text);
			group.appendChild(label);
		}
		return group;
	}

	#selectBasemap(id: BasemapId): void {
		const cfg = this.#options.basemap;
		if (!cfg || id === this.#currentBasemap) {
			this.#close();
			return;
		}
		this.#currentBasemap = id;
		try {
			if (isBasemapId(id)) localStorage.setItem(BASEMAP_STORAGE_KEY, id);
		} catch {
			// localStorage unavailable; skip persistence
		}
		cfg.onSelect(id);
		trackEvent("layer_change", { layer: id });
		this.#close();
	}

	// Accent dot on the closed button when any view-altering state is active.
	// Basemap is the default surface, so it never lights the dot; verified /
	// overlays (added later) will.
	#updateActiveDot(): void {
		this.#container?.classList.toggle("active", false);
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
		// New interaction gate — measure whether users open the consolidated
		// panel at all (the per-section events below tell us what they do once in).
		trackEvent("layers_panel_open");
	}

	#close(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = true;
		this.#button.setAttribute("aria-expanded", "false");
	}
}
