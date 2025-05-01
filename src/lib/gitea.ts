
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

export async function createIssueWithLabels(title: string, body: string, labelNames: string[]) {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    console.log('Creating issue with labels:', labelNames);
    
    // Get or create all label IDs
    const labelPromises = labelNames.map(name => getLabelId(name));
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
