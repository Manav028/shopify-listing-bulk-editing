// BACKUP FOR WHOLE CODE

// const express = require("express");
// const axios = require("axios");
// const fs = require("fs");
// const multer = require("multer");
// const { Parser } = require("json2csv");
// const path = require("path");
// const csv = require("csv-parser");
// const readline = require("readline");

// const { SHOPIFY_STORE, ACCESS_TOKEN, OUTPUT_CSV_PATH } = require("./config/config");
// const app = express();

// const upload = multer({
//   dest: "uploads/", 
//   fileFilter: (req, file, cb) => {
//     if (file.mimetype === "text/plain") {
//       return cb(null, true);
//     }
//     cb(new Error("Only .txt files are allowed"));
//   }
// });

// // Function to handle rate limits from Shopify API
// const handleRateLimit = async (error) => {
//   if (error.response && error.response.status === 429) {
//     const retryAfter = error.response.headers['retry-after'] || 10;
//     console.log(`Rate limit hit, retrying after ${retryAfter} seconds...`);
//     await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000)); 
//     return true; 
//   }
//   return false; 
// };

// const headers = {
//   "X-Shopify-Access-Token": ACCESS_TOKEN,
//   "Content-Type": "application/json",
// };

// // Function to update price on Shopify product variant
// const updateVariantPrice = async (variantId, newPrice) => {
//   variantId = String(variantId); 

//   const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`;

//   try {
//     console.log(`Updating price for variant ID: ${variantId} to ${newPrice}`);
//     const response = await axios.put(
//       url,
//       {
//         variant: {
//           id: variantId,
//           price: newPrice,
//         },
//       },
//       { headers }
//     );
//     console.log(`Price updated for variant ID: ${variantId}, New Price: ${newPrice}`);
//   } catch (error) {
//     console.error(`Error updating price for variant ID ${variantId}:`, error.response ? error.response.data : error.message);
//     if (await handleRateLimit(error)) {
//       return updateVariantPrice(variantId, newPrice); 
//     }
//   }
// };


// const fetchAllProducts = async () => {
//   let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?fields=id,variants&limit=250`;
//   const allProducts = [];

//   try {

//     while (url) {
//       const response = await axios.get(url, { headers });

//       console.log(`Fetched ${response.data.products.length} products from Shopify`);
//       const products = response.data.products;
//       for (const product of products) {
//         product.variants.forEach((variant) => {
//           allProducts.push({
//             id: variant.id,
//             sku: variant.sku,
//             price: variant.price,
//           });
//         });
//       }
//       url =
//         response.headers.link &&
//         response.headers.link.includes('rel="next"')
//           ? response.headers.link
//               .split(",")
//               .find((link) => link.includes('rel="next"'))
//               .match(/<(.*?)>/)[1]
//           : null;
//     }

//     console.log(`Total products fetched: ${allProducts.length}`);
//     return allProducts;
//   } catch (error) {
//     console.error("Error fetching product data:", error.response ? error.response.data : error.message);
//     throw new Error("Failed to fetch products");
//   }
// };


// const saveToCsv = async (data) => {
//   try {

//     const dir = path.dirname(OUTPUT_CSV_PATH);
//     if (!fs.existsSync(dir)) {
//       fs.mkdirSync(dir, { recursive: true });
//     }

//     const parser = new Parser();
//     const csv = parser.parse(data);
//     fs.writeFileSync(OUTPUT_CSV_PATH, csv); 
//     console.log(`CSV file saved at: ${OUTPUT_CSV_PATH}`);
//   } catch (error) {
//     console.error("Error saving CSV file:", error.message);
//     throw new Error("Failed to save CSV");
//   }
// };


// app.get("/download-products", async (req, res) => {
//   try {
//     console.log("Fetching all product data...");
//     const productData = await fetchAllProducts();
//     await saveToCsv(productData);


//     res.download(OUTPUT_CSV_PATH, (err) => {
//       if (err) {
//         console.error("Error sending file:", err);
//         res.status(500).send("Error downloading file");
//       }
//     });
//   } catch (error) {
//     console.error("Error downloading product data:", error.message);
//     res.status(500).send("Error downloading product data");
//   }
// });

// app.post("/upload", upload.single("file"), async (req, res) => {
//   if (!req.file) {
//     return res.status(400).send("No file uploaded.");
//   }

//   const filePath = path.join(__dirname, req.file.path);
//   const uploadedData = [];

  
//   const txtFilePath = path.join(__dirname, "uploads", "output.txt");
//   const txtStream = fs.createWriteStream(txtFilePath, { flags: "w" });

  
//   const rl = readline.createInterface({
//     input: fs.createReadStream(filePath),
//     crlfDelay: Infinity,
//   });

//   rl.on("line", (line) => {
//     const columns = line.split("\t"); // Assuming tab-separated values
//     if (columns.length === 3) {
//       const [id, sku, price] = columns;

//       // Handle large numbers as strings to avoid scientific notation
//       uploadedData.push({
//         id: String(id), // Convert to string to avoid scientific notation
//         sku: sku.trim(),
//         price: price.trim(),
//       });

//       // Write the line to the output .txt file
//       txtStream.write(`${id}\t${sku}\t${price}\n`);
//     }
//   });

//   rl.on("close", async () => {
//     console.log("TXT file processed and saved.");

//     // Close the file stream
//     txtStream.end();

//     // Loop through uploaded data and update prices
//     for (const data of uploadedData) {
//       try {
//         console.log(`Processing SKU: ${data.sku}, Variant ID: ${data.id}, Price: ${data.price}`);
//         await updateVariantPrice(data.id, data.price); // Update price based on variant ID
//         // Delay between requests to avoid hitting the rate limit
//         await delay(500); // Add delay to ensure no more than 2 requests per second
//       } catch (error) {
//         console.error("Error updating price for SKU:", data.sku, error.message);
//       }
//     }

//     res.status(200).send(`File uploaded and processed. Converted to TXT. Download from: ${txtFilePath}`);
//   });

//   rl.on("error", (error) => {
//     console.error("Error processing file:", error.message);
//     res.status(500).send("Error processing file.");
//   });
// });


// // Function to implement a delay between API requests
// const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
