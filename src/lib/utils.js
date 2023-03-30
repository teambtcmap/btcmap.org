import { toast } from '@zerodevx/svelte-toast';
import { theme } from '$lib/store';
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

export const updateChartThemes = (upToDateChart, totalChart, legacyChart, paymentMethodChart) => {
	if (get(theme) === 'dark') {
		upToDateChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
		upToDateChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
		totalChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
		totalChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
		legacyChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
		legacyChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
		paymentMethodChart.options.scales.x.grid.color = 'rgba(255, 255, 255, 0.15)';
		paymentMethodChart.options.scales.y.grid.color = 'rgba(255, 255, 255, 0.15)';
		upToDateChart.update();
		totalChart.update();
		legacyChart.update();
		paymentMethodChart.update();
	} else {
		upToDateChart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
		upToDateChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
		totalChart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
		totalChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
		legacyChart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
		legacyChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
		paymentMethodChart.options.scales.x.grid.color = 'rgba(0, 0, 0, 0.1)';
		paymentMethodChart.options.scales.y.grid.color = 'rgba(0, 0, 0, 0.1)';
		upToDateChart.update();
		totalChart.update();
		legacyChart.update();
		paymentMethodChart.update();
	}
};
