import { writable } from "svelte/store";

// Tracks whether the left panels (list + drawer) are collapsed to maximize map space.
// Resets on page load (not persisted to localStorage).
export const panelCollapsed = writable(false);
