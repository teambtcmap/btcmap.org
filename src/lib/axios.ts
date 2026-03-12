import axios from "axios";
import axiosRetry from "axios-retry";

const isServer = typeof window === "undefined";

const api = axios.create({
	timeout: 600000,
	headers: isServer ? { "User-Agent": "btcmap.org" } : {},
});

// Guard for test environments where axios may be auto-mocked
if (api?.interceptors) {
	axiosRetry(api, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
}

export default api;
