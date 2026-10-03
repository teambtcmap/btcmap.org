// Keeps Tab focus inside a modal surface (modals, the mobile list panel):
// call from a keydown handler with the surface's root element.

// Candidates; isTabStop below decides which ones Tab actually visits
const FOCUSABLE = [
	"button",
	"a[href]",
	"input",
	"select",
	"textarea",
	"[tabindex]",
].join(", ");

// Tab skips negative tabindex and disabled controls, including ones
// disabled through a <fieldset> (only :disabled catches those). Hidden
// breakpoint variants (display: none) have no client rects; visibility:
// hidden keeps the boxes, so check the computed (inherited) value too.
const isTabStop = (el: HTMLElement): boolean =>
	el.tabIndex >= 0 &&
	!el.matches(":disabled") &&
	el.getClientRects().length > 0 &&
	getComputedStyle(el).visibility !== "hidden";

// A named radio group is a single Tab stop: its checked radio, or its first
// one when none is checked. The other radios would otherwise pose as
// boundaries (e.g. the basemap picker that ends the map tools modal).
const isRadio = (el: HTMLElement): el is HTMLInputElement =>
	el instanceof HTMLInputElement && el.type === "radio" && el.name !== "";

const radioGroupStop = (
	radio: HTMLInputElement,
	candidates: HTMLElement[],
): HTMLInputElement => {
	const group = candidates.filter(
		(el): el is HTMLInputElement => isRadio(el) && el.name === radio.name,
	);
	return group.find((el) => el.checked) ?? group[0];
};

const focusableIn = (root: HTMLElement): HTMLElement[] => {
	const candidates = Array.from(
		root.querySelectorAll<HTMLElement>(FOCUSABLE),
	).filter(isTabStop);
	return candidates.filter(
		(el) => !isRadio(el) || radioGroupStop(el, candidates) === el,
	);
};

export const trapTab = (event: KeyboardEvent, root: HTMLElement): void => {
	if (event.key !== "Tab") return;
	// Another open dialog holds focus (e.g. a Save prompt over the list
	// panel, wherever it sits in the DOM): Tab is that dialog's business
	const active = document.activeElement;
	const dialog = active?.closest('[aria-modal="true"]');
	if (dialog && dialog !== root) return;

	const items = focusableIn(root);
	if (!items.length) return;

	const first = items[0];
	const last = items[items.length - 1];
	const inside = active instanceof Node && root.contains(active);

	if (!inside) {
		event.preventDefault();
		(event.shiftKey ? last : first).focus();
	} else if (event.shiftKey && active === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && active === last) {
		event.preventDefault();
		first.focus();
	}
};
