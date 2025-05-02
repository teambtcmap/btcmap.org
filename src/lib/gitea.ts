import axios from 'axios';
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';
import { getRandomColor } from '$lib/utils';

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
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
    const existingLabels = await getLabels();
    const existingLabel = existingLabels.find(l => l.name === name);
    if (existingLabel) {
      return existingLabel.id;
    }

    // Get the area type from the API
    let areaType: string | undefined;
    try {
      const areaResponse = await axios.get(`https://api.btcmap.org/v2/areas/${name}`);
      areaType = areaResponse.data?.tags?.type;
    } catch (error) {
      console.log(`Area ${name} not found, using random color`);
    }

    // Define colors based on area type
    let color = '';
    if (areaType === 'country') {
      color = '4A90E2'; // Blue for countries
    } else if (areaType === 'community') {
      color = '7ED321'; // Green for communities
    } else {
      color = getRandomColor();
    }

    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
      {
        name,
        color,
        description: `Auto-generated label for ${name}${areaType ? ` (${areaType})` : ''}`
      },
      { headers }
    );
    return response.data.id;
  } catch (error) {
    console.error(`Failed to create/get label ${name}:`, error);
    throw error;
  }
}

export async function createIssueWithLabels(title: string, body: string, labelNames: string[]) {
  console.log('createIssueWithLabels - Input:', { title, labelNames });
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    console.log('Attempting to create/get labels...');
    const labelPromises = labelNames.map(name => createLabel(name));
    const labelIds = await Promise.all(labelPromises);
    console.log('Label IDs resolved:', labelIds);

    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues`,
      { title, body, labels: labelIds },
      { headers }
    );

    return response;
  } catch (error) {
    console.error('Failed to create issue:', error);
    throw error;
  }
}