const { fetchAllProducts } = require("../services/shopifyService");
const { saveToCsv } = require("../services/csvService");
const { OUTPUT_CSV_PATH } = require("../config/config");

exports.downloadProducts = async (req, res) => {
  try {
    const productData = await fetchAllProducts();
    await saveToCsv(productData);
    res.download(OUTPUT_CSV_PATH);
  } catch (error) {
    res.status(500).send("Error downloading product data");
  }
};
