import axios from 'axios';
import { env } from '$env/dynamic/private';
import { getRandomColor } from '$lib/utils';
import { get } from 'svelte/store';
import { areas } from '$lib/store';

import type { GiteaLabel } from '$lib/types';

export type GiteaRepo = 'btcmap-data' | 'btcmap-infra';

async function getLabels(repo: GiteaRepo = 'btcmap-data'): Promise<GiteaLabel[]> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		const response = await axios.get(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`,
			{ headers }
		);
		return response.data;
	} catch (error) {
		console.error('Failed to fetch labels:', error);
		return [];
	}
}

async function createLabel(name: string, repo: GiteaRepo = 'btcmap-data'): Promise<number | null> {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		const existingLabels = await getLabels(repo);
		const existingLabel = existingLabels.find((l) => l.name === name);
		if (existingLabel) {
			return existingLabel.id;
		}

		const areaDetails = get(areas).find((area) => area.id === name);
		const areaType = areaDetails?.tags?.type;
		const areaName = areaDetails?.tags?.name || name;

		let color = '';
		if (areaType === 'country') {
			color = '4A90E2';
		} else if (areaType === 'community') {
			color = '7ED321';
		} else {
			color = getRandomColor().substring(1);
		}

		const response = await axios.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/labels`,
			{
				name,
				color,
				description: `Auto-generated label for ${areaName}${areaType ? ` (${areaType})` : ''}`
			},
			{ headers }
		);
		return response.data.id;
	} catch (error) {
		console.error(`Failed to create/get label ${name}:`, error);
		throw error;
	}
}

export async function createIssueWithLabels(
	title: string,
	body: string,
	labelIds: number[],
	repo: GiteaRepo = 'btcmap-data',
	areaLabels: string[] = []
) {
	const headers = {
		Authorization: `token ${env.GITEA_API_KEY}`
	};

	try {
		// Get IDs for area labels (create if they don't exist)
		const areaLabelIds = await Promise.all(areaLabels.map((name) => createLabel(name, repo)));
		const validAreaLabelIds = areaLabelIds.filter((id): id is number => id !== null);

		const allLabelIds = [...labelIds, ...validAreaLabelIds];

		const response = await axios.post(
			`${env.GITEA_API_URL}/api/v1/repos/teambtcmap/${repo}/issues`,
			{ title, body, labels: allLabelIds },
			{ headers }
		);

		return response;
	} catch (error) {
		console.error(`Failed to create issue in ${repo}:`, error);
		throw error;
	}
}
