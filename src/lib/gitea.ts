
import axios from 'axios';
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';
import { get } from 'svelte/store';
import { areas, elements } from '$lib/store';

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

async function getAreaLabelsFromElement(elementId: string): Promise<string[]> {
  const elementsList = get(elements);
  const areasList = get(areas);
  
  const element = elementsList.find(e => e.id === elementId);
  if (!element || !element.areas) {
    console.log('No element or areas found for ID:', elementId);
    return [];
  }

  const areaLabels = element.areas
    .map(areaId => areasList.find(a => a.id === areaId))
    .filter(area => area !== undefined)
    .map(area => area.tags?.url_alias)
    .filter(alias => alias !== undefined);

  console.log('Found area labels:', areaLabels);
  return areaLabels;
}

async function getAreaLabelsFromCoords(lat: number, lon: number): Promise<string[]> {
  try {
    const response = await axios.get(`https://api.btcmap.org/v2/elements/nearby?lat=${lat}&lon=${lon}&limit=1`);
    if (response.data && response.data.length > 0) {
      return getAreaLabelsFromElement(response.data[0].id);
    }
  } catch (error) {
    console.error('Failed to get nearby elements:', error);
  }
  return [];
}


async function getLabels(): Promise<GiteaLabel[]> {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    const response = await axios.get(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
      { headers }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to fetch labels:', error);
    return [];
  }
}

async function createLabel(name: string): Promise<number | null> {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    // First try to get existing label
    const existingLabels = await getLabels();
    const existingLabel = existingLabels.find(l => l.name === name);
    if (existingLabel) {
      return existingLabel.id;
    }

    // Generate a valid 6-character hex color
    const color = Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    
    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
      {
        name,
        color,
        description: `Auto-generated label for ${name}`
      },
      { headers }
    );
    console.log(`Created label: ${name} with ID: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error(`Failed to create/get label ${name}:`, error);
    if (error.response?.data?.message) {
      console.error('Error message:', error.response.data.message);
    }
    throw error; // Propagate error instead of returning null
  }
}

async function getLabelId(name: string): Promise<number | null> {
  const labels = await getLabels();
  const label = labels.find(l => l.name === name);
  if (label) {
    return label.id;
  }
  return createLabel(name);
}

export async function createIssueWithLabels(title: string, body: string, labelNames: string[], elementId?: string) {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    // Get area labels if element ID is provided
    let allLabels = [...labelNames];
    if (elementId) {
      const areaLabels = await getAreaLabelsFromElement(elementId);
      allLabels = [...labelNames, ...areaLabels];
    }
    
    console.log('Creating issue with labels:', allLabels);
    
    // Get or create all label IDs
    const labelPromises = allLabels.map(name => getLabelId(name));
    const labelIds = await Promise.all(labelPromises);
    
    // No need to filter null values since getLabelId now throws errors
    const labels = labelIds;
    
    console.log('Resolved label IDs:', labels);

    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues`,
      { title, body, labels },
      { headers }
    );
    
    console.log('Created issue with ID:', response.data.number);
    return response;
  } catch (error) {
    console.error('Failed to create issue:', error);
    if (error.response?.data) {
      console.error('API Error response:', error.response.data);
    }
    throw error;
  }
}
