/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte}'],
	theme: {
		extend: {
			colors: {
				primary: '#144046',
				link: '#0099AF',
				highlight: '#051173',
				teal: '#E4EBEC',
				offwhite: '#F0F6F6',
				hover: '#00B7D2',
				grey: '#9FB4B6',
				input: '#BDD2D4',
				error: '#DF3C3C',
				body: '#3E6267',
				supporter: '#095D73',
				lightBlue: '#D4E1E2',
				mapButton: '#5F5F5F',
				mobileMenu: '#085D69',
				mobileButtons: '#D6E4E6',
				mobileButtonsActive: '#C3DCDF'
			}
		}
	},
	plugins: []
};
