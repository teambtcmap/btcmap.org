// Scroll an element into view inside its own scrolling panel (a map drawer)
// by setting that panel's scrollTop. scrollIntoView would also scroll every
// ancestor, the page and the map container included, which on mobile drags
// the drawer's surroundings along.

function scrollParent(el: HTMLElement): HTMLElement | null {
	for (let node = el.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if (
			(overflowY === "auto" || overflowY === "scroll") &&
			node.scrollHeight > node.clientHeight
		) {
			return node;
		}
	}
	return null;
}

export function revealInScrollParent(el: HTMLElement): void {
	const panel = scrollParent(el);
	if (!panel) return;
	const view = panel.getBoundingClientRect();
	const target = el.getBoundingClientRect();
	const overflow = target.bottom - view.bottom;
	if (overflow <= 0) return;
	// Bottom into view, but never push the top out above the panel
	panel.scrollTop += Math.min(overflow, target.top - view.top);
}
