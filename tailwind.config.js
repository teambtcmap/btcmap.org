/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: ['./src/**/*.{html,js,ts,svelte}'],
	theme: {
		fontSize: {
			xs: ['12px', '16px'],
			sm: ['14px', '20px'],
			base: ['16px', '24px'],
			lg: ['18px', '28px'],
			xl: ['20px', '28px'],
			'2xl': ['24px', '32px'],
			'3xl': ['30px', '36px'],
			'4xl': ['36px', '40px'],
			'5xl': ['48px', '1'],
			'6xl': ['60px', '1'],
			'7xl': ['72px', '1'],
			'8xl': ['96px', '1'],
			'9xl': ['128px', '1']
		},
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
				mapHighlight: '#1C4347',
				mapLabel: '#A4A4A4',
				searchHover: '#F8F8F8',
				searchSubtext: '#999999',
				mobileMenu: '#085D69',
				mobileButtons: '#D6E4E6',
				mobileButtonsActive: '#C3DCDF',
				statPositive: '#0B9072',
				statNegative: '#EB5757',
				taggerTime: '#7C9CA0',
				created: '#10B791',
				deleted: '#EB5757',
				bitcoin: '#F7931A',
				bitcoinHover: '#F9A136',
				nostr: '#8b5cf6',
				twitter: '#1DA1F2',
				dark: '#06171C'
			},
			keyframes: {
				wiggle: {
					'0%, 100%': { transform: 'rotate(-3deg)' },
					'50%': { transform: 'rotate(3deg)' }
				}
			},
			animation: {
				wiggle: 'wiggle 1s ease-in-out infinite'
			}
		}
	},
	plugins: []
};
