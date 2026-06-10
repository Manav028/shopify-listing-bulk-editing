const fs = require("fs");
const readline = require("readline");
const path = require("path");
const pLimit = require("p-limit");
const Bottleneck = require('bottleneck');
const { deleteProduct } = require("../services/cscartService");

const {
  updateVariantPrice,
  addProductToCollection,
  updateSEOmetafield,
  reorderSmartCollection,
  createSmartCollection,
  updateProductVendor,
  createSmartCollectionWithJSON,
  migrateVendorRuleToMetafield,
  updateItemManufacturesMetafield,
  updatePublishedDate,
  createProduct,
  uploadProductImage,
  deleteProduct: deleteProductShopify
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
    case "reorder_products.txt":
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
    case "create_smart_json.txt":
    case "create_smart_json.tsv":
      fileType = "create_smart_JSON";
      break;
    case "migrate_vendor_rule_to_metafield.txt":
    case "migrate_vendor_rule_to_metafield.tsv":
      fileType = "migrate_vendor_rule_to_metafield";
      break;
    case "updateitemmanufacturesmetafield.txt":
    case "updateitemmanufacturesmetafield.tsv":
      fileType = "updateItemManufacturesMetafield";
      break;
    case "update_publisheddate.txt":
    case "update_publisheddate.tsv":
      fileType = "update_PublishedDate";
      break;
    case "delete_products.txt":
    case "delete_products.tsv":
      fileType = "delete_products";
      break;
    case "create_product.txt":
    case "create_product.tsv":
      fileType = "create_product";
      break;
    case "upload_product_image.txt":
    case "upload_product_image.tsv":
      fileType = "upload_product_image";
      break;
    case "delete_products_shopify.txt":
    case "delete_products_shopify.tsv":
      fileType = "delete_products_shopify";
      break;
    default:
      return res.status(400).send("Invalid file name. Expected one of: price_update, seo_metafields, reorder_products, create_smart_collection, vendor_update,create_smart_JSON");
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
            if (fields.length < 4) continue;
            const [product_id, variant_id, sku, price, compare_at_price] = fields;
            apiTasks.push({
              type: fileType,
              product_id,
              variant_id,
              sku,
              price,
              compare_at_price: compare_at_price || null,
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

          case "create_smart_JSON":
            if (fields.length < 3) continue;
            const [collectionTitle, rulesJSON, disjunctiveFlag, description] = fields;
            apiTasks.push({
              type: fileType,
              title: collectionTitle.trim(),
              rulesJSON: rulesJSON.trim(),
              disjunctive: String(disjunctiveFlag).trim().toLowerCase() === "true",
              description: description,
            });
            break;

          case "migrate_vendor_rule_to_metafield":
            if (fields.length !== 1) continue;
            const [collection_Id] = fields;
            apiTasks.push({
              type: fileType,
              collectionId: collection_Id,
            })
            break;

          case "updateItemManufacturesMetafield":
            if (fields.length !== 2) continue;
            const [productIdManufacture, manufacturer] = fields;
            apiTasks.push({
              type: fileType,
              productId: productIdManufacture,
              manufacturer,
            });
            break;

          case "update_PublishedDate":
            if (fields.length !== 2) continue;
            const [productIdPublishedDate, publishedDate] = fields;
            apiTasks.push({
              type: fileType,
              productId: productIdPublishedDate,
              publishedDate,
            });
            break;

          case "delete_products":
            if (fields.length !== 1) continue;
            const [productIdToDelete] = fields;

            apiTasks.push({
              type: fileType,
              productId: productIdToDelete,
            });
            break;

          case "create_product":
            if (fields.length < 2) continue;

            const [title, Product_sku, Product_price, chargeTax] = fields;

            apiTasks.push({
              type: fileType,
              title,
              sku: Product_sku,
              price: Product_price || "0.00",
              chargeTax: chargeTax === "false" ? false : true
            });
            break;

          case "upload_product_image":
            if (fields.length < 2) continue;

            const [productId_code, imageUrl, altText] = fields;

            apiTasks.push({
              type: fileType,
              productId: productId_code,
              imageUrl,
              altText: altText || ""
            });
            break;

          case "delete_products_shopify":
            if (fields.length !== 1) continue;
            const [productIdToDelete2] = fields;
            apiTasks.push({
              type: fileType,
              productId:  productIdToDelete2,
            });
        }
      } catch (err) {
        console.error(`Error parsing line: ${line}`, err);
      }
    }

    const processTask = async (task) => {
      try {
        switch (task.type) {
          case "price_update":
            await updateVariantPrice(task.variant_id, task.price, task.compare_at_price)
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

          case "create_smart_JSON":
            let rules;
            try {
              rules = JSON.parse(task.rulesJSON);
            } catch (err) {
              console.error("Invalid rules JSON:", task.rulesJSON);
              break;
            }

            await createSmartCollectionWithJSON(task.title, rules, task.disjunctive, task.description);
            break;

          case "migrate_vendor_rule_to_metafield":
            await migrateVendorRuleToMetafield(task.collectionId);
            break;

          case "updateItemManufacturesMetafield":
            await updateItemManufacturesMetafield(task.productId, task.manufacturer);
            break;

          case "update_PublishedDate":
            await updatePublishedDate(task.productId, task.publishedDate);
            break;

          case "delete_products":
            const deleteResult = await deleteProduct(task.productId);
            if (!deleteResult.success) {
              console.error(`Failed to delete product ${task.productId}:`, deleteResult.error);
            } else {
              console.log(`Deleted product ${task.productId}`, deleteResult.fallback ? "(fallback used)" : "");
            }
            break;

          case "create_product":
            await createProduct(task.title,task.sku,task.price,task.chargeTax);
            break;
          
          case "upload_product_image":
            await uploadProductImage(task.productId, task.imageUrl, task.altText);
            break;  

          case "delete_products_shopify":
            await deleteProductShopify(task.productId);
            break;
        }


      } catch (err) {
        console.error(`Error processing ${task.sku || task.product_Id || task.vendor}:`, err.message);
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