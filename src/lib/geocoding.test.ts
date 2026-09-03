import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reverseGeocode } from "./geocoding";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

afterEach(() => {
	vi.clearAllMocks();
});

describe("reverseGeocode", () => {
	it("calls Nominatim reverse with the expected URL and params", async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: {} });

		await reverseGeocode(52.52, 13.405, "de");

		expect(mockedAxios.get).toHaveBeenCalledTimes(1);
		const [url, config] = mockedAxios.get.mock.calls[0];
		expect(url).toBe("https://nominatim.openstreetmap.org/reverse");
		expect(config?.params).toEqual({
			lat: 52.52,
			lon: 13.405,
			format: "jsonv2",
			zoom: 18,
			addressdetails: 1,
			"accept-language": "de",
		});
	});

	it("composes street, house number, postcode and settlement", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				display_name: "21, Freiheitsstraße, Mitte, Berlin, 10115, Deutschland",
				address: {
					house_number: "21",
					road: "Freiheitsstraße",
					city: "Berlin",
					postcode: "10115",
				},
			},
		});

		await expect(reverseGeocode(52.52, 13.405, "de")).resolves.toBe(
			"Freiheitsstraße 21, 10115 Berlin",
		);
	});

	it("prefers the most specific settlement and skips missing parts", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				address: {
					road: "Hauptstraße",
					village: "Kleindorf",
					municipality: "Großkreis",
				},
			},
		});

		await expect(reverseGeocode(50, 10, "en")).resolves.toBe(
			"Hauptstraße, Kleindorf",
		);
	});

	it("falls back to display_name when no usable parts exist", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: {
				display_name: "Somewhere remote, Country",
				address: {},
			},
		});

		await expect(reverseGeocode(50, 10, "en")).resolves.toBe(
			"Somewhere remote, Country",
		);
	});

	it("returns null when Nominatim cannot resolve the point", async () => {
		mockedAxios.get.mockResolvedValueOnce({
			data: { error: "Unable to geocode" },
		});

		await expect(reverseGeocode(0, 0, "en")).resolves.toBeNull();
	});

	it("returns null when the payload has neither parts nor display_name", async () => {
		mockedAxios.get.mockResolvedValueOnce({ data: {} });

		await expect(reverseGeocode(50, 10, "en")).resolves.toBeNull();
	});

	it("returns null when the request fails", async () => {
		mockedAxios.get.mockRejectedValueOnce(new Error("timeout"));

		await expect(reverseGeocode(50, 10, "en")).resolves.toBeNull();
	});
});
