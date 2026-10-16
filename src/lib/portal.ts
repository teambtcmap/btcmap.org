// Svelte action that renders a node at the end of <body>: the map drawers are
// position-fixed with their own stacking context, which would trap a fixed
// overlay (a modal, the photo viewer) inside them.
export const portal = (node: HTMLElement) => {
	document.body.appendChild(node);
	return { destroy: () => node.remove() };
};
