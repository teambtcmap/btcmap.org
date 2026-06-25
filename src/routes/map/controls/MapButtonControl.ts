import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { _, locale } from "$lib/i18n";

import "./controls.css";

// Material `tune` (sliders) glyph — the tools (layers & filters) trigger.
// Material `menu` (hamburger) glyph — the page-navigation menu trigger.
// Inlined from the app's Iconify set (`ic:outline-tune` / `ic:outline-menu`)
// rather than rendered via <Icon>: the IControl builds raw DOM, and inlining
// lets an always-visible map button paint instantly with no Iconify API
// fetch — same approach as the app's other inlined map-control glyphs.
export const TUNE_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z"/></svg>`;

export const MENU_ICON_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z"/></svg>`;

type Options = {
	iconSvg: string;
	// i18n key for the button title / aria-label, re-translated on locale change.
	labelKey: string;
	onClick: () => void;
};

// A minimal MapLibre IControl: one icon button in the top-right control
// group that runs onClick. The popover content lives in Svelte-managed
// modals (MapToolsModal / MapMenuModal) — this just renders a native-looking
// trigger so it sits flush with zoom / locate / globe.
export class MapButtonControl implements IControl {
	#options: Options;
	#container: HTMLDivElement | undefined;
	#unsubLocale: (() => void) | null = null;

	constructor(options: Options) {
		this.#options = options;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "dialog");
		button.innerHTML = this.#options.iconSvg;
		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#options.onClick();
		});
		container.appendChild(button);
		this.#container = container;

		// subscribe() fires synchronously, so this also sets the initial label.
		this.#unsubLocale = locale.subscribe(() => {
			const label = get(_)(this.#options.labelKey);
			button.title = label;
			button.setAttribute("aria-label", label);
		});

		return container;
	}

	onRemove(): void {
		this.#unsubLocale?.();
		this.#unsubLocale = null;
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}
}
