
import axios from 'axios';
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';

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
    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
      {
        name,
        color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
      },
      { headers }
    );
    return response.data.id;
  } catch (error) {
    console.error(`Failed to create label ${name}:`, error);
    return null;
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

export async function createIssueWithLabels(title: string, body: string, labelNames: string[]) {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    // Get or create all label IDs
    const labelPromises = labelNames.map(name => getLabelId(name));
    const labelIds = await Promise.all(labelPromises);
    
    // Filter out any null values from failed label creation
    const labels = labelIds.filter((id): id is number => id !== null);

    return await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues`,
      { title, body, labels },
      { headers }
    );
  } catch (error) {
    console.error('Failed to create issue:', error);
    throw error;
  }
}
