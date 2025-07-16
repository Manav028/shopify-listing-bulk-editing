require("dotenv").config();
const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const { fetchAllProducts } = require("./shopifyService");
const { readSKUsFromCSV, saveToCsv } = require("./csvService");

const compareSKUs = async (csvFilePath) => {
  try {
    console.time("SKU Comparison Time");

    const [skuPriceMap, shopifyProducts] = await Promise.all([
      readSKUsFromCSV(csvFilePath),
      fetchAllProducts(),
    ]);

    const shopifySKUSet = new Set(shopifyProducts.map((p) => p.sku));

    const result = Array.from(skuPriceMap.entries()).map(([sku, price]) => ({
      sku,
      price,
      exists: shopifySKUSet.has(sku),
    }));

    console.timeEnd("SKU Comparison Time");

    fs.writeFileSync("sku_result.json", JSON.stringify(result, null, 2));
    await saveToCsv(result, `${Date.now()}-Price-increase.csv`);

    console.log("Comparison completed.");
  } catch (err) {
    console.error("SKU Comparison Failed:", err.message);
  }
};

const csvPath = path.join(__dirname, "../../allproduct", "peglabel.csv");
compareSKUs(csvPath);

module.exports = { compareSKUs };