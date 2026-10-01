import { API_BASE } from "$lib/api-base";
import api from "$lib/axios";

import type { PlaceImage } from "$types/btcmap-api/PlaceImage";

// Community photos of a place (btcmap-api place images, #1469). The list
// call returns metadata only, so the UI can lay out exact-ratio boxes and
// fetch each image's bytes in parallel at the size it needs.

export type PlacePhoto = PlaceImage;

// Longest side we upload. Phone photos are 4–8 MB at 12 MP; the API caps
// uploads at 10 MB decoded, and nothing we render needs more than this.
export const UPLOAD_MAX_SIDE = 2048;
const UPLOAD_JPEG_QUALITY = 0.85;

export const placePhotoUrl = (
	placeId: number,
	imageId: number,
	bounds: { w?: number; h?: number } = {},
): string => {
	const params = new URLSearchParams();
	// The API answers 400 to w=0, so only forward positive bounds
	if (bounds.w && bounds.w > 0) params.set("w", String(Math.round(bounds.w)));
	if (bounds.h && bounds.h > 0) params.set("h", String(Math.round(bounds.h)));
	const query = params.toString();
	return `${API_BASE}/v4/places/${placeId}/images/${imageId}${query ? `?${query}` : ""}`;
};

const isPlacePhoto = (value: unknown): value is PlacePhoto => {
	if (typeof value !== "object" || value === null) return false;
	const it = value as Record<string, unknown>;
	return (
		typeof it.id === "number" &&
		typeof it.width === "number" &&
		typeof it.height === "number" &&
		it.width > 0 &&
		it.height > 0
	);
};

// Only `type=user` uploads are public here: report evidence is for
// reviewers and can show the reporter (e.g. a selfie at the storefront).
export const fetchPlacePhotos = async (
	placeId: number,
): Promise<PlacePhoto[]> => {
	const res = await api.get<unknown>(
		`${API_BASE}/v4/places/${placeId}/images?type=user`,
	);
	if (!Array.isArray(res.data)) return [];
	return res.data.filter(isPlacePhoto);
};

export const uploadPlacePhoto = async (
	placeId: number,
	token: string,
	dataBase64: string,
): Promise<PlacePhoto> => {
	const res = await api.post<unknown>(
		`${API_BASE}/v4/places/${placeId}/images`,
		{ data_base64: dataBase64 },
		{ headers: { Authorization: `Bearer ${token}` } },
	);
	if (!isPlacePhoto(res.data)) {
		throw new Error("place image upload returned an unexpected response");
	}
	return res.data;
};

export const fitWithin = (
	width: number,
	height: number,
	maxSide: number,
): { width: number; height: number } => {
	const scale = Math.min(1, maxSide / Math.max(width, height));
	return {
		width: Math.round(width * scale),
		height: Math.round(height * scale),
	};
};

// Re-encode in the browser before upload. Drawing to a canvas applies the
// EXIF rotation and drops every EXIF field (GPS included) — the API stores
// uploads byte-for-byte and serves them publicly — and shrinks phone photos.
export const prepareUpload = async (file: File): Promise<string> => {
	const bitmap = await createImageBitmap(file, {
		imageOrientation: "from-image",
	});
	const { width, height } = fitWithin(
		bitmap.width,
		bitmap.height,
		UPLOAD_MAX_SIDE,
	);
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("canvas 2d context unavailable");
	ctx.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();

	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, "image/jpeg", UPLOAD_JPEG_QUALITY),
	);
	if (!blob) throw new Error("could not encode photo");

	const dataUrl = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
	// Strip the `data:image/jpeg;base64,` prefix
	return dataUrl.slice(dataUrl.indexOf(",") + 1);
};
