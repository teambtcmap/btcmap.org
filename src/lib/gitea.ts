
import axios from 'axios';
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';

async function createLabel(label: string) {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    await axios.post(
      `${GITEA_API_URL}/repos/teambtcmap/btcmap-data/labels`,
      {
        name: label,
        color: '#' + Math.floor(Math.random()*16777215).toString(16) // Random color
      },
      { headers }
    );
  } catch (error) {
    // Ignore 422 errors as they mean the label already exists
    if (error.response?.status !== 422) {
      console.error(`Failed to create label ${label}:`, error);
    }
  }
}

export async function createIssueWithLabels(title: string, body: string, labels: string[]) {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  try {
    // Try to create the issue with labels first
    return await axios.post(
      `${GITEA_API_URL}/teambtcmap/btcmap-data/issues`,
      { title, body, labels },
      { headers }
    );
  } catch (error) {
    // If we get a 422 error, check if it's label related
    if (error.response?.status === 422 && error.response.data.message?.includes('label')) {
      console.warn('Label creation needed:', error.response.data.message);
      // Create all labels since we don't know which ones specifically failed
      await Promise.all(labels.map(label => createLabel(label)));
      // Retry the issue creation
      try {
        return await axios.post(
          `${GITEA_API_URL}/teambtcmap/btcmap-data/issues`,
          { title, body, labels },
          { headers }
        );
      } catch (retryError) {
        console.error('Failed to create issue after creating labels:', retryError);
        throw retryError;
      }
    }
    console.error('Failed to create issue:', error);
    throw error;
  }
}
