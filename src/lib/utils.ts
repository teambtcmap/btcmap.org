import { theme } from '$lib/store';
import { latCalc, longCalc } from '$lib/map/setup';
import { areasSync } from '$lib/sync/areas';
import type { Continents, Element, Grade, IssueIcon} from '$lib/types';
import { toast } from '@zerodevx/svelte-toast';
import type { Chart } from 'chart.js';
import { get } from 'svelte/store';
import rewind from '@mapbox/geojson-rewind';
import { geoContains } from 'd3-geo';

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

export const getGrade = (upToDatePercent: number): Grade => {
	switch (true) {
		case upToDatePercent >= 95:
			return 5;
		case upToDatePercent >= 75:
			return 4;
		case upToDatePercent >= 50:
			return 3;
		case upToDatePercent >= 25:
			return 2;
		case upToDatePercent >= 0:
		default:
			return 1;
	}
};

export const getIssueIcon = (issue_code: string): IssueIcon => {
	if (issue_code.startsWith('invalid_tag_value')) {
		return 'fa-calendar-days';
	}
	if (issue_code.startsWith('misspelled_tag_name')) {
		return 'fa-spell-check';
	}
	if (issue_code == 'missing_icon') {
		return 'fa-icons';
	}
	if (issue_code == 'not_verified') {
		return 'fa-clipboard-question';
	}
	if (issue_code == 'outdated') {
		return 'fa-hourglass-end';
	}
	if (issue_code == 'outdated_soon') {
		return 'fa-hourglass-half';
	}
	return 'fa-list-check';
};

export const getIssueHelpLink = (issue_code: string) => {
	if (issue_code == 'outdated' || issue_code == 'outdated_soon' || issue_code == 'not_verified') {
		return 'https://wiki.btcmap.org/general/outdated';
	}
	if (issue_code.startsWith('invalid_tag_value')) {
		return 'https://wiki.btcmap.org/general/tagging-instructions#verified-tags---more-information';
	}
	if (issue_code.startsWith('misspelled_tag_name')) {
		return 'https://wiki.btcmap.org/general/tagging-instructions#required-tags';
	}
	return undefined;
};

export const isEven = (number: number) => {
	return number % 2 === 0;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function debounce(func: (e?: any) => void, timeout = 500) {
	let timer: ReturnType<typeof setTimeout>;
	// @ts-expect-error: introducing typecheck, this was failing, so ingoring for now
	return (...args) => {
		clearTimeout(timer);
		timer = setTimeout(() => {
			// @ts-expect-error: introducing typecheck, this was failing, so ingoring for now
			func.apply(this, args);
		}, timeout);
	};
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export const validateContinents = (continent: Continents) =>
	[
		'africa',
		'asia',
		'europe',
		'north-america',
		'oceania',
		'south-america',
		'Africa',
		'Asia',
		'Europe',
		'North America',
		'Oceania',
		'South America'
	].includes(continent);

export const isBoosted = (element: Element) =>
	element.tags['boost:expires'] && Date.parse(element.tags['boost:expires']) > Date.now();

export function getAreasByElementId(elementId: string): Array<[
  string,             // Area ID
  string | undefined, // URL Alias for the area, if available
  string | undefined  // Type of the area, if available
]> {
  console.log('getAreasByElementId called with:', elementId);

  const element = get(elements).find(element => element.id === elementId);
  if (!element) {
    console.log('No element found for ID:', elementId);
    return [];
  }

  console.log('Found element:', element);

  const lat = latCalc(element.osm_json);
  const long = longCalc(element.osm_json);
  return get(areas)
    .filter(area => {
      if (!area.tags.geo_json) return false;
      let rewoundPoly = rewind(area.tags.geo_json, true);
      return geoContains(rewoundPoly, [long, lat]);
    })
    .map(area => [area.id, area.tags.url_alias, area.tags.type]);
}

export async function getAreasByCoordinates(lat: number, long: number): Promise<Array<[
  string,             // Area ID 
  string | undefined, // URL Alias for the area, if available
  string | undefined  // Type of the area, if available
]>> {
  console.log('Checking areas with coordinates:', {lat, long});
  await areasSync(); // Explicitly sync areas
  const allAreas = get(areas);
  console.log('Total areas to check:', allAreas.length);

  return allAreas
    .filter(area => {
      if (!area.tags.geo_json) {
        console.log('Area missing geo_json:', area.id);
        return false;
      }
      let rewoundPoly = rewind(area.tags.geo_json, true);
      const contains = geoContains(rewoundPoly, [long, lat]);
      if (contains) {
        console.log('Found matching area:', area.id);
      }
      return contains;
    })
    .map(area => [area.id, area.tags.url_alias, area.tags.type]);
}