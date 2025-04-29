// If we get a 422 error, check if it's label related
    if (error.response?.status === 422 && error.response.data.message?.includes('label')) {
      console.warn('Label creation needed:', error.response.data.message);
      // Create all labels since we don't know which ones specifically failed
      await Promise.all(labels.map(label => createLabel(label)));
      // Retry the issue creation
      return axios.post(
        `${GITEA_API_URL}/repos/teambtcmap/btcmap-data/issues`,
        { title, body, labels },
        { headers }
      );
    }