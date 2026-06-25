import type {
	ControlPosition,
	IControl,
	Map as MapLibreMap,
} from "maplibre-gl";
import { get } from "svelte/store";

import { trackEvent } from "$lib/analytics";
import { _, locale } from "$lib/i18n";
import { session } from "$lib/session";

import "./controls.css";

// Collapses /map's page-navigation links (home → add-location → community
// map → account) into a single menu button that expands a popup list,
// replacing the always-visible page-link button stack. Two variants:
//  - "main": home → add-location → community map → account (used by /map)
//  - "communities": home → merchant map → account (used by /communities/map)
// Labels re-translate on locale change; the account row re-renders on
// session change so in-place auth flows stay correct without a reload.
export type NavButtonsVariant = "main" | "communities";

type LinkRow = {
	a: HTMLAnchorElement;
	titleKey: string;
};

export class MapMenuControl implements IControl {
	#variant: NavButtonsVariant;
	#container: HTMLDivElement | undefined;
	#button: HTMLAnchorElement | undefined;
	#popup: HTMLDivElement | undefined;
	#staticRows: LinkRow[] = [];
	#unsubs: Array<() => void> = [];
	#docClickHandler: ((e: MouseEvent) => void) | null = null;

	constructor(variant: NavButtonsVariant = "main") {
		this.#variant = variant;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className =
			"maplibregl-ctrl maplibregl-ctrl-group maplibre-next-menu";

		const button = document.createElement("a");
		button.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		button.href = "#";
		button.tabIndex = 0;
		button.setAttribute("role", "button");
		button.setAttribute("aria-haspopup", "true");
		button.setAttribute("aria-expanded", "false");
		// Inline hamburger glyph (3 lines), stroke=currentColor so the
		// dark-mode invert rule in controls.css applies like the others.
		button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
		button.addEventListener("click", (e) => {
			e.preventDefault();
			this.#toggle();
		});
		container.appendChild(button);

		const popup = document.createElement("div");
		popup.className = "maplibre-next-basemaps-popup maplibre-next-menu-popup";
		popup.setAttribute("role", "menu");
		popup.hidden = true;

		// Home — both variants.
		popup.appendChild(
			this.#createRow({
				href: "/",
				titleKey: "mapControls.goToHome",
				iconSrc: "/icons/home.svg",
				onClick: () => trackEvent("home_button_click"),
			}),
		);
		if (this.#variant === "main") {
			popup.appendChild(
				this.#createRow({
					href: "/add-location",
					titleKey: "mapControls.addLocation",
					iconSrc: "/icons/marker.svg",
					onClick: () => trackEvent("add_location_click"),
				}),
			);
			popup.appendChild(
				this.#createRow({
					href: "/communities/map",
					titleKey: "mapControls.communityMap",
					iconSrc: "/icons/group.svg",
					onClick: () => trackEvent("community_map_click"),
				}),
			);
		} else {
			popup.appendChild(
				this.#createRow({
					href: "/map",
					titleKey: "mapControls.merchantMap",
					iconSrc: "/icons/shopping.svg",
					onClick: () => {},
				}),
			);
		}

		// Account / Log in — session-driven href + label.
		const accountRow = document.createElement("a");
		accountRow.className = "maplibre-next-menu-row";
		accountRow.setAttribute("role", "menuitem");
		const accountImg = document.createElement("img");
		accountImg.src = "/icons/account.svg";
		accountImg.width = 16;
		accountImg.height = 16;
		const accountText = document.createElement("span");
		accountRow.appendChild(accountImg);
		accountRow.appendChild(accountText);
		accountRow.addEventListener("click", () => {
			trackEvent("account_button_click", { logged_in: !!get(session) });
		});
		popup.appendChild(accountRow);

		container.appendChild(popup);
		this.#container = container;
		this.#button = button;
		this.#popup = popup;

		const updateAccount = () => {
			const loggedIn = !!get(session);
			const tt = get(_);
			const title = loggedIn
				? tt("mapControls.account")
				: tt("mapControls.login");
			accountRow.href = loggedIn ? "/user/activity" : "/login";
			accountRow.setAttribute("aria-label", title);
			accountText.textContent = title;
			accountImg.alt = loggedIn
				? tt("mapControls.accountAlt")
				: tt("mapControls.loginAlt");
		};
		const updateLabels = () => {
			const tt = get(_);
			const menuLabel = tt("mapControls.menu");
			button.title = menuLabel;
			button.setAttribute("aria-label", menuLabel);
			for (const r of this.#staticRows) {
				const t = tt(r.titleKey);
				r.a.setAttribute("aria-label", t);
				const span = r.a.querySelector("span");
				if (span) span.textContent = t;
			}
		};

		// subscribe() fires synchronously, so initial render flows through here.
		this.#unsubs.push(session.subscribe(updateAccount));
		this.#unsubs.push(
			locale.subscribe(() => {
				updateAccount();
				updateLabels();
			}),
		);

		this.#docClickHandler = (e) => {
			if (!this.#container?.contains(e.target as Node)) this.#close();
		};
		document.addEventListener("click", this.#docClickHandler);

		return container;
	}

	onRemove(): void {
		for (const u of this.#unsubs) u();
		this.#unsubs = [];
		this.#staticRows = [];
		if (this.#docClickHandler) {
			document.removeEventListener("click", this.#docClickHandler);
			this.#docClickHandler = null;
		}
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
		this.#button = undefined;
		this.#popup = undefined;
	}

	#createRow(opts: {
		href: string;
		titleKey: string;
		iconSrc: string;
		onClick: () => void;
	}): HTMLAnchorElement {
		const a = document.createElement("a");
		a.className = "maplibre-next-menu-row";
		a.href = opts.href;
		a.setAttribute("role", "menuitem");
		const img = document.createElement("img");
		img.src = opts.iconSrc;
		img.width = 16;
		img.height = 16;
		const span = document.createElement("span");
		a.appendChild(img);
		a.appendChild(span);
		a.addEventListener("click", opts.onClick);
		this.#staticRows.push({ a, titleKey: opts.titleKey });
		return a;
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
		// New interaction gate — measure whether users open the collapsed menu
		// at all (vs. the old always-visible links).
		trackEvent("nav_menu_open", { variant: this.#variant });
	}

	#close(): void {
		if (!this.#popup || !this.#button) return;
		this.#popup.hidden = true;
		this.#button.setAttribute("aria-expanded", "false");
	}
}
