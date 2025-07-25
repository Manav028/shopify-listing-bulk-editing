const fs = require("fs");
const readline = require("readline");
const path = require("path");
const { updateVariantPrice, addProductToCollection, updateSEOmetafield, delay, reorderSmartCollection  } = require("../services/shopifyService");

exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const filePath = req.file.path;
  if (!fs.existsSync(filePath)) {
    return res.status(500).send("File does not exist.");
  }

  const uploadedData = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity
  });

  let isFirstRow = true; 

  rl.on("line", (line) => {
  if (isFirstRow) {
    isFirstRow = false;
    return;
  }

  try {
    const fields = line.split("\t");

    if (fields.length === 5) {
      const [product_id, variant_id, sku, price, collectionId] = fields;
      uploadedData.push({ type: "price_update_collection", product_id, variant_id, sku, price, collectionId });
    } else if (fields.length === 2) {
      console.log("2")
      const [product_id, product_title] = fields;
      uploadedData.push({ type: "metafield_update", product_id, product_title });
    } else if (fields.length === 3) {
      const [product_id, collectionId, rank] = fields;
      uploadedData.push({ type: "reorder_product", product_id, collectionId, rank });
    } else {
      console.warn(`Skipping invalid line: ${line}`);
    }
    } catch (err) {
      console.error(`Error parsing line: ${line}`, err);
    }
  });

  rl.on("close", async () => {
    try {      
      for (const data of uploadedData) {
        if (data.type === "price_update_collection") {
          console.log(`Updating SKU: ${data.sku}, Variant ID: ${data.variant_id}, Price: ${data.price}`);
          await updateVariantPrice(data.variant_id, data.price);
          if (data.collectionId) {
            console.log(`Adding Product ID: ${data.product_id} to Collection ID: ${data.collectionId}`);
            await addProductToCollection(data.product_id, data.collectionId);
          }
        } else if (data.type === "metafield_update") {
          console.log(`Updating SEO Metafield for Product ID: ${data.product_id}`);
          await updateSEOmetafield(data.product_id, data.product_title);
        } 
        else if (data.type === "reorder_product") {
        console.log(`Reordering Product ID: ${data.product_id} in Collection ID: ${data.collectionId} to position ${data.rank}`);
        await reorderSmartCollection(data.collectionId, data.product_id, data.rank.toString()); 
      }
        await delay(2000);
      }

      res.status(200).send("File processed successfully!");
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


