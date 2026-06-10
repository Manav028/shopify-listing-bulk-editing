const path = require("path");

const getFilePaths = (fileName) => {
  const localDir = "/tmp";

  return {
    localDir,
    localFilePath: path.join(localDir, fileName),
    dropboxPath: `/exports/${fileName}`,
  };
};

module.exports = { getFilePaths };