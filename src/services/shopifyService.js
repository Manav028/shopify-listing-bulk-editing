const axios = require("axios");
const { SHOPIFY_STORE, ACCESS_TOKEN } = require("../config/config");
const { json } = require("express");

const headers = {
  "X-Shopify-Access-Token": ACCESS_TOKEN,
  "Content-Type": "application/json",
};

// Handle rate limits from Shopify
const handleRateLimit = async (error) => {
  if (error.response && error.response.status === 429) {
    const retryAfter = error.response.headers["retry-after"] || 10;
    console.log(`Rate limit hit, retrying after ${retryAfter} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return true;
  }
  return false;
};

// Fetch all Shopify products
const fetchAllProducts = async () => {
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?fields=id,variants&limit=250`;
  const allProducts = [];

  try {
    while (url) {
      const response = await axios.get(url, { headers });

      console.log(`Fetched ${response.data.products.length} products from Shopify`);
      const products = response.data.products;

      for (const product of products) {
        product.variants.forEach((variant) => {
          allProducts.push({
            product_id: product.id,  
            variant_id: variant.id,  
            sku: variant.sku,
          });
        });
      }

      url =
        response.headers.link &&
        response.headers.link.includes('rel="next"')
          ? response.headers.link
              .split(",")
              .find((link) => link.includes('rel="next"'))
              .match(/<(.*?)>/)[1]
          : null;
    }

    console.log(`Total variants fetched: ${allProducts.length}`);
    return allProducts;
  } catch (error) {
    console.error("Error fetching product data:", error.response ? error.response.data : error.message);
    throw new Error("Failed to fetch products");
  }
};


// Update product price
const updateVariantPrice = async (variantId, newPrice) => {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`;

  try {
    console.log("Sending data to update price:", { variant: { id: variantId, price: newPrice } });
    await axios.put(url, { variant: { id: variantId, price: newPrice } }, { headers });
    console.log(`Price updated for Variant ID: ${variantId}`);
  } catch (error) {
    console.error(`Error updating variant ID ${variantId}:`, error.response ? error.response.data : error.message);
    if (await handleRateLimit(error)) {
      return updateVariantPrice(variantId, newPrice);
    }
  }
};

const addProductToCollection = async (productId, collectionId) => {
  const url = `https://${SHOPIFY_STORE}/admin/api/2025-01/collects.json`;

  try {
    console.log("Sending data to add product to collection:", { collect: { product_id: productId, collection_id: collectionId } });
    const response = await axios.post(url, {
      collect: {
        product_id: productId,
        collection_id: collectionId,
      },
    }, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error adding Product ID: ${productId} to Collection: ${error.response ? JSON.stringify(error.response.data,null,2) : error.message}`);
  }
};


const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


module.exports = { fetchAllProducts, updateVariantPrice, addProductToCollection, delay };
