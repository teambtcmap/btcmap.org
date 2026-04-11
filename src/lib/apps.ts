export type Platform = "android" | "ios" | "web" | "linux" | "windows" | "mac";

export type StoreKey =
	| "app-store"
	| "apk"
	| "f-droid"
	| "google-play"
	| "linux-package"
	| "obtainium"
	| "web"
	| "zapstore";

export type AppTag = "btcmap" | "powered-by-btcmap" | "coming-soon";

export type AppStoreEntry = {
	store: StoreKey;
	platform: Platform;
	url: string;
};

export type AppConfig = {
	id: string;
	name: string;
	// path in /static, e.g. '/images/apps/btcmap.png'
	logo: string;
	tag: AppTag;
	sponsor: boolean;
	stores: AppStoreEntry[];
};

export const appConfigs: AppConfig[] = [
	{
		id: "btcmap-android",
		name: "BTC Map",
		logo: "/images/logo.svg",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "f-droid",
				platform: "android",
				url: "https://f-droid.org/en/packages/org.btcmap/",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://github.com/teambtcmap/btcmap-android/releases/latest",
			},
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/org.btcmap",
			},
		],
	},
	{
		id: "btcmap-web",
		name: "BTC Map",
		logo: "/images/logo.svg",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "web",
				platform: "web",
				url: "/map",
			},
		],
	},
	{
		id: "btcmap-ios",
		name: "BTC Map",
		logo: "/images/logo.svg",
		tag: "btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/btc-map/id6443604345",
			},
		],
	},

	{
		id: "bitlocal",
		name: "BitLocal",
		logo: "/images/apps/bitlocal.webp",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/bitlocal-btc-friendly-shops/id6447485666",
			},
		],
	},
	{
		id: "bitkit",
		name: "Bitkit",
		logo: "/images/apps/bitkit.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/bitkit-wallet/id1637040489",
			},
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=to.bitkit",
			},
		],
	},
	{
		id: "wos",
		name: "Wallet of Satoshi",
		logo: "/images/apps/wos.png",
		tag: "powered-by-btcmap",
		sponsor: true,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.livingroomofsatoshi.wallet",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/wallet-of-satoshi/id1438599608",
			},
		],
	},
	{
		id: "alby",
		name: "Alby Go",
		logo: "/images/apps/alby.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.getalby.mobile",
			},
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/com.getalby.albygo",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://github.com/getAlby/go/releases/latest",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/alby-go/id6471335774",
			},
		],
	},
	{
		id: "aqua",
		name: "Aqua",
		logo: "/images/apps/aqua.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=io.aquawallet.android",
			},
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/io.aquawallet.android",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/aqua-wallet/id6468594241",
			},
		],
	},
	{
		id: "cash-app",
		name: "Cash App",
		logo: "/images/apps/cash-app.webp",
		tag: "powered-by-btcmap",
		sponsor: true,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.squareup.cash",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/cash-app/id711923939",
			},
		],
	},
	{
		id: "coinos",
		name: "Coinos",
		logo: "/images/apps/coinos.webp",
		tag: "powered-by-btcmap",
		sponsor: true,
		stores: [
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/io.coinos",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://github.com/coinos/coinos-ui/releases/latest",
			},
			{
				store: "web",
				platform: "web",
				url: "https://coinos.io",
			},
		],
	},
	{
		id: "fedi",
		name: "Fedi",
		logo: "/images/apps/fedi.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.fedi",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://apk.fedi.xyz",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/fedi-alpha/id6448916281",
			},
		],
	},
	{
		id: "manna",
		name: "Manna",
		logo: "/images/apps/manna.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.lightning.manna",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/manna-bitcoin-wallet/id6745337602",
			},
		],
	},
	{
		id: "stacked",
		name: "Stacked Wallet",
		logo: "/images/apps/stacked.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=nz.lightningpay.wallet",
			},
		],
	},
	{
		id: "sovran",
		name: "Sovran",
		logo: "/images/apps/sovran.png",
		tag: "powered-by-btcmap",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.sovranapp",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/in/app/sovran/id6499554529",
			},
		],
	},
	{
		id: "blink",
		name: "Blink",
		logo: "/images/apps/blink.png",
		tag: "coming-soon",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=io.blink.wallet",
			},
			{
				store: "zapstore",
				platform: "android",
				url: "https://zapstore.dev/apps/io.blink.wallet",
			},
			{
				store: "apk",
				platform: "android",
				url: "https://github.com/blinkbitcoin/blink-mobile/releases/latest",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/us/app/blink-bitcoin-wallet/id1559600189",
			},
		],
	},
	{
		id: "bull-bitcoin",
		name: "Bull Bitcoin Wallet",
		logo: "/images/apps/bull-bitcoin.png",
		tag: "coming-soon",
		sponsor: false,
		stores: [
			{
				store: "google-play",
				platform: "android",
				url: "https://play.google.com/store/apps/details?id=com.bullbitcoin.mobile",
			},
			{
				store: "app-store",
				platform: "ios",
				url: "https://apps.apple.com/ca/app/bull-bitcoin-wallet/id6474683604",
			},
		],
	},
];
