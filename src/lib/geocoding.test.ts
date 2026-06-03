import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { searchAddress } from "./geocoding";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

afterEach(() => {
	vi.clearAllMocks();
});

describe("searchAddress", () => {
	it("calls Nominatim with the expected URL and params", async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: [] });

		await searchAddress("123 main st", "de");

		expect(mockedAxios.get).toHaveBeenCalledTimes(1);
		const [url, config] = mockedAxios.get.mock.calls[0];
		expect(url).toBe("https://nominatim.openstreetmap.org/search");
		expect(config?.params).toEqual({
			q: "123 main st",
			format: "jsonv2",
			limit: 5,
			addressdetails: 0,
			"accept-language": "de",
		});
	});

	it("maps Nominatim results to GeocodeResult shape", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: [
				{
					lat: "52.5200",
					lon: "13.4050",
					display_name: "Berlin, Germany",
					place_id: 1,
				},
				{
					lat: "48.1351",
					lon: "11.5820",
					display_name: "Munich, Germany",
					place_id: 2,
				},
			],
		});

		const results = await searchAddress("germany", "en");

		expect(results).toEqual([
			{ lat: 52.52, lon: 13.405, displayName: "Berlin, Germany" },
			{ lat: 48.1351, lon: 11.582, displayName: "Munich, Germany" },
		]);
	});

	it("returns an empty array on empty response", async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: [] });

		const results = await searchAddress("nonsense xyz", "en");

		expect(results).toEqual([]);
	});

	it("drops entries with non-numeric lat or lon", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: [
				{ lat: "52.5", lon: "13.4", display_name: "good" },
				{ lat: "not-a-number", lon: "13.4", display_name: "bad lat" },
				{ lat: "52.5", lon: "also-bad", display_name: "bad lon" },
			],
		});

		const results = await searchAddress("mixed", "en");

		expect(results).toEqual([{ lat: 52.5, lon: 13.4, displayName: "good" }]);
	});

	it("throws on network error", async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error("network down"));

		await expect(searchAddress("x", "en")).rejects.toThrow("network down");
	});

	it("sets a request timeout so a hung request can't stall the UI", async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: [] });

		await searchAddress("x", "en");

		const [, config] = mockedAxios.get.mock.calls[0];
		expect(config?.timeout).toBe(8000);
	});
});
