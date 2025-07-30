const fs = require('fs');
const path = require('path');
const { Dropbox } = require('dropbox');
const { DROPBOX_TOKEN } = require('../config/config')
const fetch = require('isomorphic-fetch');

const uploadToDropbox = async (localPath, dropboxPath) => {
  const token = DROPBOX_TOKEN || process.env.DROPBOX_TOKEN;
  if (!token) throw new Error('Missing Dropbox access token');

  const dbx = new Dropbox({ accessToken: token, fetch });

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
