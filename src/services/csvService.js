const fs = require("fs");
const path = require("path");
const { Parser } = require("json2csv");
const { OUTPUT_CSV_PATH } = require("../config/config");

const saveToCsv = async (data) => {
  try {
    const dir = path.dirname(OUTPUT_CSV_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const parser = new Parser();
    const csv = parser.parse(data);
    fs.writeFileSync(OUTPUT_CSV_PATH, csv);
    console.log(`CSV file saved at: ${OUTPUT_CSV_PATH}`);
  } catch (error) {
    console.error("Error saving CSV file:", error.message);
    throw new Error("Failed to save CSV");
  }
};

module.exports = { saveToCsv };
