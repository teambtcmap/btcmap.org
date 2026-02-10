import type { Theme } from './types';
import { writable } from 'svelte/store';

// Creates a unified theme store that syncs across:
// - localStorage (persistence)
// - document.documentElement.classList (Tailwind dark mode)
// - Custom events (for non-Svelte code like charts)
// - SSR compatibility (reads from window.__INITIAL_THEME__)
function createThemeStore() {
	const { subscribe, set } = writable<Theme>('light');

	// Internal helper to sync theme across all sources (localStorage, DOM, store, events)
	const applyTheme = (theme: Theme) => {
		// SSR guard
		if (typeof window === 'undefined') return;

		// Update localStorage with error handling for blocked storage
		try {
			localStorage.theme = theme;
		} catch {
			// Storage unavailable or blocked
		}

		// Toggle dark class on document
		document.documentElement.classList.toggle('dark', theme === 'dark');

		// Update Svelte store
		set(theme);

		// Dispatch for non-Svelte code (charts, maps, etc.)
		window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
	};

	return {
		subscribe,
		set: applyTheme,
		toggle: () => {
			// SSR guard
			if (typeof window === 'undefined') return;

			// Read current theme from DOM to avoid reading stale localStorage
			const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
			const newTheme = current === 'dark' ? 'light' : 'dark';

			applyTheme(newTheme);
		},
		// Initialize theme on app mount. Must be called in +layout.svelte onMount.
		// Reads from SSR inline script (window.__INITIAL_THEME__) or falls back to localStorage/system preference.
		init: () => {
			// During SSR, window won't exist - return early
			if (typeof window === 'undefined') return;

			// Use value set by inline script in app.html (SSR-safe)
			const serverTheme = (window as { __INITIAL_THEME__?: Theme }).__INITIAL_THEME__;

			let theme: Theme;
			if (serverTheme) {
				theme = serverTheme;
			} else if ('theme' in localStorage) {
				theme = localStorage.theme === 'dark' ? 'dark' : 'light';
			} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
				theme = 'dark';
			} else {
				theme = 'light';
			}

			// Sync DOM and store without triggering side effects
			try {
				localStorage.theme = theme;
			} catch {
				// Storage unavailable
			}
			document.documentElement.classList.toggle('dark', theme === 'dark');
			set(theme);
		},
		// Get current theme value (for use outside of Svelte components)
		get current() {
			if (typeof window === 'undefined') return 'light';
			return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
		}
	};
}

// Main theme store - single source of truth for theme state.
// Use $theme in Svelte components for reactive updates.
// Use theme.init() in +layout.svelte onMount.
// Use theme.toggle() for theme toggle button.
// Use theme.current for non-reactive reads (e.g., chart initialization).
export const theme = createThemeStore();

// Utility to check if current theme is dark.
// Reactive: Use $isDark in components.
export const isDark = {
	subscribe: (fn: (value: boolean) => void) => {
		return theme.subscribe((t) => fn(t === 'dark'));
	}
};

// Utility to check if current theme is light.
// Reactive: Use $isLight in components.
export const isLight = {
	subscribe: (fn: (value: boolean) => void) => {
		return theme.subscribe((t) => fn(t === 'light'));
	}
};
