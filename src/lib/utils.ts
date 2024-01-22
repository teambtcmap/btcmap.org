import { theme } from '$lib/store';
import { toast } from '@zerodevx/svelte-toast';
import type { Chart } from 'chart.js';
import { get } from 'svelte/store';

export const errToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#DF3C3C'
		}
	});
};

export const warningToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#FACA15'
		},
		duration: 10000
	});
};

export const successToast = (m: string) => {
	toast.push(m, {
		theme: {
			'--toastBarBackground': '#22C55E'
		}
	});
};

export function getRandomColor() {
	const letters = '0123456789ABCDEF';
	let color = '#';
	for (let i = 0; i < 6; i++) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
}

export const detectTheme = () => {
	if (
		localStorage.theme === 'dark' ||
		(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
	) {
		return 'dark';
	} else {
		return 'light';
	}
};

export const updateChartThemes = (
	charts: Chart<'line' | 'bar', number[] | undefined, string>[]
) => {
	if (get(theme) === 'dark') {
		charts.forEach((chart) => {
			if (chart.options.scales?.x?.grid && chart.options.scales?.y?.grid) {
				chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
				chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
				chart.update();
			}
		});
	} else {
		charts.forEach((chart) => {
			if (chart.options.scales?.x?.grid && chart.options.scales?.y?.grid) {
				chart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
				chart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
				chart.update();
			}
		});
	}
};

export const formatElementID = (id: string) => {
	const elementIdSplit = id.split(':');
	const elementIdFormatted =
		elementIdSplit[0].charAt(0).toUpperCase() +
		elementIdSplit[0].slice(1, elementIdSplit[0].length) +
		' ' +
		elementIdSplit[1];

	return elementIdFormatted;
};
