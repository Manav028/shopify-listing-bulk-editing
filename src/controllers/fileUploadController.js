const fs = require("fs");
const readline = require("readline");
const path = require("path");
const pLimit = require("p-limit");
const Bottleneck = require('bottleneck');

const {
  updateVariantPrice,
  addProductToCollection,
  updateSEOmetafield,
  reorderSmartCollection,
  createSmartCollection,
  delay,
  updateProductVendor,
} = require("../services/shopifyService");

const limiter = new Bottleneck({
  maxConcurrent: 2,         // Same as your pLimit
  minTime: 500              // 500ms delay between each call = 2 requests/sec
});

exports.uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");

  const filePath = req.file.path;
  const fileName = req.file.originalname.toLowerCase();
  const ext = path.extname(fileName).toLowerCase();

  if (!fs.existsSync(filePath)) {
    return res.status(500).send("File does not exist.");
  }

  if (ext !== ".txt" && ext !== ".tsv") {
    return res.status(400).send("Invalid file extension. Only .txt or .tsv files are allowed.");
  }

  let fileType = null;
  switch (fileName) {
    case "price_update.txt":
    case "price_update.tsv":
      fileType = "price_update";
      break;
    case "seo_metafields.txt":
    case "seo_metafields.tsv":
      fileType = "metafield_update";
      break;
    case "  .txt":
    case "reorder_products.tsv":
      fileType = "reorder_product";
      break;
    case "create_smart_collection.txt":
    case "create_smart_collection.tsv":
      fileType = "create_smart_collection";
      break;
    case "vendor_update.txt":
    case "vendor_update.tsv":
      fileType = "vendor_update";
      break;
    case "collection_update.txt":
    case "collection_update.tsv":
      fileType = "collection_update";
      break;
    default:
      return res.status(400).send("Invalid file name. Expected one of: price_update, seo_metafields, reorder_products, create_smart_collection, vendor_update");
  }

  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstRow = true;
    const apiTasks = [];

    for await (const line of rl) {
      if (isFirstRow && fileType !== "create_smart_collection") {
        isFirstRow = false;
        continue;
      }

      try {
        const fields = line.split("\t");
        
        switch (fileType) {
          case "price_update":
            if (fields.length !== 4) continue;
            const [product_id, variant_id, sku, price] = fields;
            apiTasks.push({
              type: fileType,
              product_id,
              variant_id,
              sku,
              price,
            });
            break;

          case "metafield_update":
            if (fields.length !== 2) continue;
            const [productIdSEO, product_title] = fields;
            apiTasks.push({
              type: fileType,
              product_id: productIdSEO,
              product_title,
            });
            break;

          case "reorder_product":
            if (fields.length !== 3) continue;
            const [productIdReorder, collectionIdReorder, rank] = fields;
            apiTasks.push({
              type: fileType,
              product_id: productIdReorder,
              collectionId: collectionIdReorder,
              rank,
            });
            break;

          case "create_smart_collection":
            const vendorName = line.trim();
            if (vendorName) {
              apiTasks.push({
                type: fileType,
                vendor: vendorName,
              });
            }
            break;

          case "vendor_update":
            if (fields.length !== 2) continue;
            const [productId, vendor] = fields;
            apiTasks.push({
              type: fileType,
              productId,
              vendor,
            });
            break;

          case "collection_update":
            if (fields.length !== 2) continue;
            const [productIdCollection, collectionId] = fields;
            apiTasks.push({
              type: fileType,
              product_id: productIdCollection,
              collectionId,
            });
            break;
            
        }
      } catch (err) {
        console.error(`Error parsing line: ${line}`, err);
      }
    }

    const processTask = async (task) => {
      try {
        switch (task.type) {
          case "price_update_collection":
            await updateVariantPrice(task.variant_id, task.price);
            // if (task.collectionId) {
            //   await addProductToCollection(task.product_id, task.collectionId);
            // }
            break;

          case "metafield_update":
            await updateSEOmetafield(task.product_id, task.product_title);
            break;

          case "reorder_product":
            await reorderSmartCollection(task.collectionId, task.product_id, task.rank);
            break;

          case "create_smart_collection":
            await createSmartCollection(task.vendor);
            break;

          case "vendor_update":
            await updateProductVendor(task.productId, task.vendor);
            break;

          case "collection_update":
              await addProductToCollection(task.product_id, task.collectionId);
            break;
        }
      } catch (err) {
        console.error(`Error processing ${task.sku || task.product_id || task.vendor}:`, err.message);
      }
    };

    const taskPromises = apiTasks.map(task =>
      limiter.schedule(() => processTask(task))
    );
    
    await Promise.all(taskPromises);
    res.status(200).send("File processed successfully!");

  } catch (error) {
    console.error("Processing error:", error);
    res.status(500).send("Error processing file");
  }
};