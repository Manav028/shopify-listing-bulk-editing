const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
const fetch = require('isomorphic-fetch');
const {
  DROPBOX_APP_KEY,
  DROPBOX_APP_SECRET,
  DROPBOX_REFRESH_TOKEN,
} = require('../config/config');

const getAccessTokenFromRefreshToken = async () => {

  const authHeader = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64');

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to refresh token: ${res.statusText}\n${errorBody}`);
  }

  const data = await res.json();
  return data.access_token;
};


const uploadToDropbox = async (localPath, dropboxPath) => {
  const accessToken = await getAccessTokenFromRefreshToken();

  const dbx = new Dropbox({ accessToken, fetch });

  const fileContent = fs.readFileSync(localPath);

  try {
    const response = await dbx.filesUpload({
      path: dropboxPath,
      contents: fileContent,
      mode: 'overwrite',
    });
    console.log(`Uploaded to Dropbox: ${response.result.path_display}`);
  } catch (error) {
    console.error('Dropbox Upload Error:', error.message);
    console.error(error);
    throw error;
  }
};

module.exports = { uploadToDropbox };
