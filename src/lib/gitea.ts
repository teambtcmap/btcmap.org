
import axios from 'axios';
import { GITEA_API_KEY, GITEA_API_URL } from '$env/static/private';
import { getRandomColor } from '$lib/utils';
import { get } from 'svelte/store';
import { areas } from '$lib/store';

interface GiteaLabel {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface SimplifiedIssue {
  id: number;
  number: number;
  title: string;
  created_at: string;
  html_url: string;
  labels: GiteaLabel[];
  user: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  comments: number;
  assignees: any[];
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

    const areaDetails = get(areas).find(area => area.id === name);
    const areaType = areaDetails?.tags?.type;
    const areaName = areaDetails?.tags?.name || name;

    if (!areaDetails) {
      console.log(`Area ${name} not found in store, using random color`);
    }

    let color = '';
    if (areaType === 'country') {
      color = '4A90E2';
    } else if (areaType === 'community') {
      color = '7ED321';
    } else {
      color = getRandomColor().substring(1);
    }

    const response = await axios.post(
      `${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/labels`,
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

// Cache issues with 10 minute expiry
let issuesCache: {
  timestamp: number;
  data: { issues: SimplifiedIssue[]; totalCount: number };
} | null = null;

const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds

export async function getIssues(label?: string): Promise<{ issues: SimplifiedIssue[], totalCount: number }> {
  const headers = {
    Authorization: `token ${GITEA_API_KEY}`
  };

  // Return filtered cached data if label provided and cache exists
  if (issuesCache && Date.now() - issuesCache.timestamp < CACHE_DURATION) {
    const issues = issuesCache.data.issues;
    if (label) {
      const filteredIssues = issues.filter(issue => {
        if (!issue.labels) return false;
        
        // Check if issue has area label
        const hasAreaLabel = issue.labels.some(l => 
          l.name.toLowerCase() === label.toLowerCase()
        );
        
        // For location submissions, must have both location-submission and area label
        const isLocationSubmission = issue.labels.some(l => 
          l.name === 'location-submission'
        );
        
        return isLocationSubmission ? hasAreaLabel : hasAreaLabel;
      });
      return {
        issues: filteredIssues,
        totalCount: filteredIssues.length
      };
    }
    return issuesCache.data;
  }

  try {
    const [issuesResponse, repoResponse] = await Promise.all([
      axios.get(`${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data/issues?state=open`, { headers }),
      axios.get(`${GITEA_API_URL}/api/v1/repos/teambtcmap/btcmap-data`, { headers })
    ]);

    const simplifiedIssues = issuesResponse.data.map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      created_at: issue.created_at,
      html_url: issue.html_url,
      labels: issue.labels,
      user: {
        login: issue.user.login,
        avatar_url: issue.user.avatar_url,
        html_url: issue.user.html_url
      },
      comments: issue.comments,
      assignees: issue.assignees
    }));

    const result = {
      issues: simplifiedIssues,
      totalCount: repoResponse.data.open_issues_count
    };

    // Only cache if no label filter
    if (!label) {
      issuesCache = {
        timestamp: Date.now(),
        data: result
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch issues:', error);
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
