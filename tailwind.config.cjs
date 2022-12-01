/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte}'],
	theme: {
		extend: {
			colors: {
				primary: '#144046',
				body: '#3E6267',
				link: '#0099AF',
				hover: '#00B7D2',
				highlight: '#051173',
				input: '#BDD2D4',
				teal: '#E4EBEC',
				offwhite: '#F0F6F6',
				grey: '#9FB4B6',
				lightBlue: '#D4E1E2',
				error: '#DF3C3C',
				supporter: '#095D73',
				map: '#333333',
				mapButton: '#5F5F5F',
				mapBorder: '#E8E8E8',
				mapHighlight: '#1C4347',
				mapLabel: '#A4A4A4',
				searchHover: '#F8F8F8',
				searchSubtext: '#999999',
				mobileMenu: '#085D69',
				mobileButtons: '#D6E4E6',
				mobileButtonsActive: '#C3DCDF',
				statPositive: '#0B9072',
				statNegative: '#EB5757',
				statBorder: '#C8DCDF',
				taggerTime: '#7C9CA0',
				created: '#10B791',
				deleted: '#EB5757',
				bitcoin: '#F7931A'
			}
		}
	},
	plugins: []
};
