require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { fetchAllProducts } = require("./shopifyService");
const { readSKUsFromCSV, saveToCsv } = require("./csvService");
const { uploadToDropbox } = require("../utils/uploadToDropbox");
const { downloadFromDropbox } = require("../utils/uploadToDropbox");

const compareSKUs = async (dropboxCsvPath) => {
  try {
    console.time("SKU Comparison Time");

    // 1. Download CSV from Dropbox → /tmp
    const localCsvPath = await downloadFromDropbox(
      dropboxCsvPath,
      "peglabel.csv"
    );

    // 2. Run comparison
    const [skuPriceMap, shopifyProducts] = await Promise.all([
      readSKUsFromCSV(localCsvPath),
      fetchAllProducts(),
    ]);

    const shopifySKUSet = new Set(shopifyProducts.map((p) => p.sku));

    const result = Array.from(skuPriceMap.entries()).map(([sku, price]) => ({
      sku,
      price,
      exists: shopifySKUSet.has(sku),
    }));

    console.timeEnd("SKU Comparison Time");

    // 3. Save results to /tmp
    const fileName = 'DailyCompare.csv';
    const localDir = '/tmp'; 
    const localFilePath = path.join(localDir, fileName);
    const dropboxPath = `/exports/${fileName}`;
    await saveToCsv(result, fileName, localDir);

    console.log("Comparison completed.");

    // 4. Upload results back to Dropbox
    await uploadToDropbox(localFilePath, dropboxPath);

    console.log("Results uploaded to Dropbox.");
  } catch (err) {
    console.error("SKU Comparison Failed:", err.message);
  }
};

module.exports = { compareSKUs };
