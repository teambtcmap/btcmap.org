import { verifiedArr } from '$lib/map/setup';
import type { Element, MerchantPageData, MerchantComment, PayMerchant, Place } from '$lib/types';
import { PLACE_FIELD_SETS, buildFieldsParam } from '$lib/api-fields';
import { error } from '@sveltejs/kit';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import type { PageServerLoad } from './$types';

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const load: PageServerLoad<MerchantPageData> = async ({ params }) => {
	const { id } = params;
	try {
		let data: Element;
		let placeData: Place | null = null;

		// Fetch complete data from v4 Places API (supports both numeric Place IDs and OSM-style IDs)
		try {
			const placeResponse = await axios.get(
				`https://api.btcmap.org/v4/places/${id}?fields=${buildFieldsParam(PLACE_FIELD_SETS.COMPLETE_PLACE)}`
			);
			placeData = placeResponse.data;

			if (!placeData) {
				throw new Error('Place data not found');
			}

			// Construct Element-like data structure from Place data for backward compatibility
			const now = new Date().toISOString();

			// Extract OSM type and ID from osm_url or osm_id
			let osmType = 'node'; // default
			let osmIdNum = Number(placeData.id); // fallback

			if (placeData.osm_url) {
				const osmMatch = placeData.osm_url.match(/openstreetmap\.org\/([^/]+)\/(\d+)/);
				if (osmMatch) {
					osmType = osmMatch[1];
					osmIdNum = Number(osmMatch[2]);
				}
			} else if (placeData.osm_id) {
				const parts = placeData.osm_id.split(':');
				if (parts.length === 2) {
					osmType = parts[0];
					osmIdNum = Number(parts[1]);
				}
			}

			data = {
				id: placeData.id.toString(),
				osm_json: {
					type: osmType as 'node' | 'way' | 'relation',
					id: osmIdNum,
					lat: placeData.lat,
					lon: placeData.lon,
					bounds: null, // Not applicable for nodes
					tags: Object.fromEntries(
						Object.entries({
							// Core info
							name: placeData.name,
							'addr:full': placeData.address,
							description: placeData.description,
							note: placeData['osm:note'],
							opening_hours: placeData.opening_hours,

							// Contact info
							phone: placeData.phone || placeData['osm:contact:phone'],
							website: placeData.website || placeData['osm:contact:website'],
							email: placeData.email || placeData['osm:contact:email'],
							'contact:twitter': placeData.twitter || placeData['osm:contact:twitter'],
							'contact:facebook': placeData.facebook || placeData['osm:contact:facebook'],
							'contact:instagram': placeData.instagram || placeData['osm:contact:instagram'],
							'contact:line': placeData.line,

							// Payment methods
							'payment:lightning':
								placeData['payment:lightning'] || placeData['osm:payment:lightning'],
							'payment:onchain': placeData['payment:onchain'] || placeData['osm:payment:onchain'],
							'payment:lightning_contactless':
								placeData['payment:lightning_contactless'] ||
								placeData['osm:payment:lightning_contactless'],
							'payment:bitcoin': placeData['osm:payment:bitcoin'],
							'payment:uri': placeData['payment:uri'] || placeData['osm:payment:uri'],
							'payment:pouch': placeData['payment:pouch'] || placeData['osm:payment:pouch'],
							'payment:coinos': placeData['payment:coinos'] || placeData['osm:payment:coinos'],
							'payment:lightning:requires_companion_app':
								placeData.required_app_url ||
								placeData['osm:payment:lightning:requires_companion_app']
									? 'yes'
									: undefined,
							'payment:lightning:companion_app_url':
								placeData.required_app_url || placeData['osm:payment:lightning:companion_app_url'],

							// Survey/verification dates
							'survey:date': placeData['osm:survey:date'],
							check_date: placeData['osm:check_date'],
							'check_date:currency:XBT': placeData['osm:check_date:currency:XBT'],
							verified_at: placeData.verified_at,

							// Metadata
							'icon:android': placeData.icon,
							amenity: placeData['osm:amenity'],
							category: placeData['osm:category'],

							// IDs
							osm_id: placeData.osm_id,
							osm_url: placeData.osm_url,
							btcmap_id: placeData.id.toString(),

							// Boost
							'boost:expires': placeData.boosted_until,

							// Timestamps
							created_at: placeData.created_at,
							updated_at: placeData.updated_at
						}).filter(([, value]) => value !== undefined && value !== null && value !== '')
					)
				},
				tags: {
					'icon:android': placeData.icon || 'question_mark',
					category: 'merchant', // Default category
					'payment:uri': placeData['payment:uri'],
					'payment:pouch': placeData['payment:pouch'],
					'payment:coinos': placeData['payment:coinos'],
					'boost:expires': placeData.boosted_until,
					'payment:lightning': placeData['payment:lightning'] || placeData['osm:payment:lightning'],
					'payment:onchain': placeData['payment:onchain'] || placeData['osm:payment:onchain'],
					'payment:lightning_contactless':
						placeData['payment:lightning_contactless'] ||
						placeData['osm:payment:lightning_contactless']
				},
				created_at: placeData.created_at || now,
				updated_at: placeData.updated_at || now,
				deleted_at: placeData.deleted_at || ''
			};
		} catch (fetchError) {
			console.error(`Failed to fetch Place data for ID ${id}:`, fetchError);
			throw fetchError; // Re-throw to be handled by outer catch
		}
		const lat = placeData.lat;
		const lon = placeData.lon;

		if (data && data.id && lat && lon) {
			let comments: MerchantComment[] = [];
			
			// Only fetch comments if merchant is not deleted
			if (!data.deleted_at) {
				try {
					// Fetch comments directly from the dedicated comments endpoint
					const commentsResponse = await axios.get(`https://api.btcmap.org/v4/places/${id}/comments`);
					comments = commentsResponse.data;
				} catch {
					// Comments endpoint failed - use empty array
					comments = [];
				}
			}

			// Process all merchant data server-side (same logic as client initializeData)
			const icon = data.tags['icon:android'];
			const address = placeData.address;
			const description = placeData.description;
			const note = placeData['osm:note'];
			const hours = data.osm_json.tags?.['opening_hours'];

			const payment: PayMerchant = data.tags['payment:uri']
				? { type: 'uri', url: data.tags['payment:uri'] }
				: data.tags['payment:pouch']
					? { type: 'pouch', username: data.tags['payment:pouch'] }
					: data.tags['payment:coinos']
						? { type: 'coinos', username: data.tags['payment:coinos'] }
						: undefined;

			const boosted =
				data.tags['boost:expires'] && Date.parse(data.tags['boost:expires']) > Date.now()
					? data.tags['boost:expires']
					: undefined;

			const verified = verifiedArr(placeData);
			const phone = data.osm_json.tags?.phone || data.osm_json.tags?.['contact:phone'];
			const website = data.osm_json.tags?.website || data.osm_json.tags?.['contact:website'];
			const email = data.osm_json.tags?.email || data.osm_json.tags?.['contact:email'];
			const twitter = data.osm_json.tags?.twitter || data.osm_json.tags?.['contact:twitter'];
			const instagram = data.osm_json.tags?.instagram || data.osm_json.tags?.['contact:instagram'];
			const facebook = data.osm_json.tags?.facebook || data.osm_json.tags?.['contact:facebook'];

			const thirdParty =
				data.osm_json.tags?.['payment:lightning:requires_companion_app'] === 'yes' &&
				data.osm_json.tags['payment:lightning:companion_app_url'];

			const paymentMethod =
				data.osm_json.tags &&
				(data.osm_json.tags['payment:onchain'] ||
					data.osm_json.tags['payment:lightning'] ||
					data.osm_json.tags['payment:lightning_contactless']);

			return {
				id: data.id,
				name: data.osm_json.tags?.name,
				lat,
				lon,
				comments,
				// Additional processed fields
				icon,
				address,
				description,
				note,
				hours,
				payment,
				boosted,
				verified,
				phone,
				website,
				email,
				twitter,
				instagram,
				facebook,
				thirdParty,
				paymentMethod,
				// OSM data for edit links and tag functionality
				osmType: data.osm_json.type,
				osmId: data.osm_json.id,
				osmTags: data.osm_json.tags || {},
				// Place data for BoostButton and other components
				placeData: placeData!
			};
		}
		error(404, 'Merchant Not Found');
	} catch (err) {
		console.error(err);
		error(404, 'Merchant Not Found');
	}
};
