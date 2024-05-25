import { read } from '$app/server';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { html as toReactNode } from 'satori-html';
import Manrope from '../../../static/fonts/Manrope-Regular.ttf';

const fontData = read(Manrope).arrayBuffer();

const height = 630;
const width = 1200;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const generateImage = async (component: any) => {
	const jsx = toReactNode(`${component.html}<style>${component.css.code}</style>`);

	const svg = await satori(jsx, {
		fonts: [
			{
				name: 'Manrope',
				data: await fontData,
				style: 'normal'
			}
		],
		height,
		width
	});

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: 'width',
			value: width
		}
	});

	const image = resvg.render();

	return image.asPng();
};
