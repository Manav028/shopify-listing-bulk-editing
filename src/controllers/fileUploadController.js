const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { updateVariantPrice, addProductToCollection, delay } = require("../services/shopifyService");

exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const filePath = req.file.path; 

  if (!fs.existsSync(filePath)) {
    return res.status(500).send("File does not exist.");
  }

  const uploadedData = [];
  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  rl.on("line", (line) => {
    try {
      const [product_id, variant_id, sku ,price, collectionId] = line.split("\t");
      uploadedData.push({ product_id, variant_id, sku ,price, collectionId});
      console.log(uploadedData)
    } catch (err) {
      console.error(`Error parsing line: ${line}`, err);
    }
  });

  rl.on("close", async () => {
    try {
      for (const data of uploadedData) {
        console.log(`Updating SKU: ${data.sku}, Variant ID: ${data.variant_id}, Price: ${data.price}`);
        await updateVariantPrice(data.variant_id, data.price);

        

        if (data.collectionId) {
          console.log(`Adding Product ID: ${data.product_id} to Collection ID: ${data.collectionId}`);
          await addProductToCollection(data.product_id, data.collectionId);
        }

        await delay(2000);
      }

      res.status(200).send("File processed successfully! Prices updated & products added to collections.");
    } catch (error) {
      console.error("Error processing uploaded data:", error.message);
      res.status(500).send("Error processing data.");
    }
  });

  rl.on("error", (error) => {
    console.error("Error reading file:", error.message);
    res.status(500).send("Error reading file.");
  });
};  
