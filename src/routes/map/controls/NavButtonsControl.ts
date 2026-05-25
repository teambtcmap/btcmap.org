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

// Mirrors /map's `homeMarkerButtons` (src/lib/map/setup.ts) as a
// MapLibre custom IControl. Two variants:
//  - "main": home → add-location → community map → account (used by /map)
//  - "communities": home → merchant map → account (used by /communities/map)
// All button tooltips/aria-labels re-translate on locale change so the
// language toggle reflects across the entire UI without a page reload.
export type NavButtonsVariant = "main" | "communities";

type ButtonRefs = {
	a: HTMLAnchorElement;
	img: HTMLImageElement;
	titleKey: string;
	altKey: string;
};

export class NavButtonsControl implements IControl {
	#variant: NavButtonsVariant;
	#container: HTMLDivElement | undefined;
	#unsubs: Array<() => void> = [];
	#staticButtons: ButtonRefs[] = [];

	constructor(variant: NavButtonsVariant = "main") {
		this.#variant = variant;
	}

	getDefaultPosition(): ControlPosition {
		return "top-right";
	}

	onAdd(_map: MapLibreMap): HTMLElement {
		const container = document.createElement("div");
		container.className = "maplibregl-ctrl maplibregl-ctrl-group";

		// Home — always present in both variants
		container.appendChild(
			this.#createStaticButton({
				href: "/",
				titleKey: "mapControls.goToHome",
				iconSrc: "/icons/home.svg",
				altKey: "mapControls.goToHomeAlt",
				onClick: () => trackEvent("home_button_click"),
			}),
		);

		if (this.#variant === "main") {
			container.appendChild(
				this.#createStaticButton({
					href: "/add-location",
					titleKey: "mapControls.addLocation",
					iconSrc: "/icons/marker.svg",
					altKey: "mapControls.addLocationAlt",
					onClick: () => trackEvent("add_location_click"),
				}),
			);
			container.appendChild(
				this.#createStaticButton({
					href: "/communities/map",
					titleKey: "mapControls.communityMap",
					iconSrc: "/icons/group.svg",
					altKey: "mapControls.communityMapAlt",
					onClick: () => trackEvent("community_map_click"),
				}),
			);
		} else {
			container.appendChild(
				this.#createStaticButton({
					href: "/map",
					titleKey: "mapControls.merchantMap",
					iconSrc: "/icons/shopping.svg",
					altKey: "mapControls.merchantMapAlt",
					onClick: () => {},
				}),
			);
		}

		// Account / Log in — href + labels driven by session subscription so
		// the button stays correct after in-place auth flows (no reload).
		const accountBtn = document.createElement("a");
		accountBtn.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		accountBtn.setAttribute("role", "button");
		const accountImg = document.createElement("img");
		accountImg.src = "/icons/account.svg";
		accountImg.width = 16;
		accountImg.height = 16;
		accountBtn.appendChild(accountImg);
		accountBtn.addEventListener("click", () => {
			trackEvent("account_button_click", { logged_in: !!get(session) });
		});
		container.appendChild(accountBtn);

		const updateAccount = () => {
			const loggedIn = !!get(session);
			const tt = get(_);
			const title = loggedIn
				? tt("mapControls.account")
				: tt("mapControls.login");
			accountBtn.href = loggedIn ? "/user/activity" : "/login";
			accountBtn.title = title;
			accountBtn.setAttribute("aria-label", title);
			accountImg.alt = loggedIn
				? tt("mapControls.accountAlt")
				: tt("mapControls.loginAlt");
		};

		const updateStaticButtons = () => {
			const tt = get(_);
			for (const b of this.#staticButtons) {
				const title = tt(b.titleKey);
				b.a.title = title;
				b.a.setAttribute("aria-label", title);
				b.img.alt = tt(b.altKey);
			}
		};

		// subscribe() fires synchronously with the current value, so the
		// initial render flows through these too — no separate init path.
		this.#unsubs.push(session.subscribe(updateAccount));
		this.#unsubs.push(
			locale.subscribe(() => {
				updateAccount();
				updateStaticButtons();
			}),
		);

		this.#container = container;
		return container;
	}

	onRemove(): void {
		for (const u of this.#unsubs) u();
		this.#unsubs = [];
		this.#staticButtons = [];
		this.#container?.parentNode?.removeChild(this.#container);
		this.#container = undefined;
	}

	#createStaticButton(opts: {
		href: string;
		titleKey: string;
		iconSrc: string;
		altKey: string;
		onClick: () => void;
	}): HTMLAnchorElement {
		const a = document.createElement("a");
		a.className = "maplibregl-ctrl-icon maplibregl-ctrl-link";
		a.href = opts.href;
		a.setAttribute("role", "button");
		const img = document.createElement("img");
		img.src = opts.iconSrc;
		img.width = 16;
		img.height = 16;
		a.appendChild(img);
		a.addEventListener("click", opts.onClick);
		this.#staticButtons.push({
			a,
			img,
			titleKey: opts.titleKey,
			altKey: opts.altKey,
		});
		return a;
	}
}
