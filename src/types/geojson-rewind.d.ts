declare module '@mapbox/geojson-rewind' {
	import type { GeoJSON } from 'geojson';
	export default function rewind<T extends GeoJSON>(gj: T, outer?: boolean): T;
}
declare module '@mapbox/geojson-rewind' {
  import { GeoJSON } from 'geojson';
  export default function rewind(gj: GeoJSON, outer?: boolean): GeoJSON;
}
