// Resolved API base URL. Defaults to the production endpoint; override via
// VITE_API_BASE_URL in .env for local development (e.g. "/btcmap-api-proxy"
// to route through the Vite dev proxy, or "http://127.0.0.1:8000" directly).
export const API_BASE: string =
	import.meta.env.VITE_API_BASE_URL || "https://api.btcmap.org";
