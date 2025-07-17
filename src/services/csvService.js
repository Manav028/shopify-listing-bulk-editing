const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const { OUTPUT_CSV_PATH } = require("../config/config");
const csv = require("csv-parser");

const saveToCsv = async (data, fileName, outputDir = path.join(__dirname, '..', 'data')) => {
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, fileName);

    const parser = new Parser();
    const csv = parser.parse(data);
    fs.writeFileSync(filePath, csv);
    console.log(`CSV file saved at: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error("Error saving CSV:", error.message);
    throw new Error("Failed to save CSV");
  }
};


const readSKUsFromCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const skuPriceMap = new Map(); 
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        const sku = row.ItemNumber?.trim();
        const price = row.Cost?.trim();

        if (sku && price) {
          skuPriceMap.set(sku, price);
        }
      })
      .on("end", () => resolve(skuPriceMap))
      .on("error", reject);
  });
};

module.exports = { saveToCsv, readSKUsFromCSV };