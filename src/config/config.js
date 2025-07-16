require("dotenv").config();

module.exports = {
  SHOPIFY_STORE: process.env.SHOPIFY_STORE,
  ACCESS_TOKEN: process.env.ACCESS_TOKEN,
  CSV_FILE_PATH: process.env.CSV_FILE_PATH,
  OUTPUT_CSV_PATH: process.env.OUTPUT_CSV_PATH,
  OPENAI_API: process.env.OPENAI_API,
  API_VERSION : process.env.API_VERSION
};
