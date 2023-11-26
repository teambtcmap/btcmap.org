import { theme } from '$lib/store';
import { toast } from '@zerodevx/svelte-toast';
import { get } from 'svelte/store';

export const errToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#DF3C3C'
		}
	});
};

export const warningToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#FACA15'
		},
		duration: 10000
	});
};

export const successToast = (m) => {
	toast.pop();

	toast.push(m, {
		theme: {
			'--toastBarBackground': '#22C55E'
		}
	});
};

export function getRandomColor() {
	var letters = '0123456789ABCDEF';
	var color = '#';
	for (var i = 0; i < 6; i++) {
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

export const updateChartThemes = (charts) => {
	if (get(theme) === 'dark') {
		charts.forEach((chart) => {
			chart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
			chart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
			chart.update();
		});
	} else {
		charts.forEach((chart) => {
			chart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
			chart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
			chart.update();
		});
	}
};
