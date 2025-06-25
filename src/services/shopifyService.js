const axios = require("axios");
const { SHOPIFY_STORE, ACCESS_TOKEN, API_VERSION } = require("../config/config");
const { json } = require("express");
const { openaiSEO } = require('../services/openaiService')

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
  let url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?fields=id,title,variants,body_html&limit=250`;
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
            product_title: product.title,
            product_price: variant.price,
            product_description: product.body_html,
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

// Upload Title and description metafield
const updateSEOmetafield = async (productId, productname) => {
  try {
    const openaiResponse = await openaiSEO(productname);

    if (!openaiResponse || !openaiResponse.data) {
      throw new Error("OpenAI failed to generate SEO content");
    }

    const { meta_title, meta_description, product_description } = openaiResponse.data;

    console.log(`🔹 Checking existing metafields for product ${productId}...`);

    const metafieldsResponse = await axios.get(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/metafields.json`,
      { headers }
    );

    const existingMetafields = metafieldsResponse.data.metafields;

    const titleMetafield = existingMetafields.find(meta => meta.namespace === "global" && meta.key === "title_tag");
    const descriptionMetafield = existingMetafields.find(meta => meta.namespace === "global" && meta.key === "description_tag");

    const metafields = [];

    if (titleMetafield) {
      metafields.push({
        id: titleMetafield.id,
        namespace: "global",
        key: "title_tag",
        value: meta_title,
        type: "single_line_text_field"
      });
    } else {
      metafields.push({
        namespace: "global",
        key: "title_tag",
        value: meta_title,
        type: "single_line_text_field"
      });
    }

    if (descriptionMetafield) {
      metafields.push({
        id: descriptionMetafield.id,
        namespace: "global",
        key: "description_tag",
        value: meta_description,
        type: "single_line_text_field"
      });
    } else {
      metafields.push({
        namespace: "global",
        key: "description_tag",
        value: meta_description,
        type: "single_line_text_field"
      });
    }

    console.log(`Updating metafields for Product ID: ${productId}...`);

    for (const metafield of metafields) {
      if (metafield.id) {
        await axios.put(
          `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/metafields/${metafield.id}.json`,
          { metafield },
          { headers }
        );
        
      } else {
        await axios.post(
          `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/metafields.json`,
          { metafield: metafield },
          { headers }
        );
      }
    }

    await updateProductDetails(productId,product_description,meta_title)

    console.log(`SEO Metafields updated for Product ID: ${productId}`);
    return { success: true };

  } catch (error) {
    console.error(`Error updating SEO metafields for product ${productId}:`, error.message);
    return { error: error.message };
  }
};

// update product description 
const updateProductDetails = async (productId, newDescription, metaTitle) => {
  try {
    console.log(`🔹 Fetching product details for Product ID: ${productId}...`);

    const productResponse = await axios.get(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}.json`,
      { headers }
    );

    if (!productResponse.data || !productResponse.data.product) {
      throw new Error("Failed to retrieve product data.");
    }

    const existingProduct = productResponse.data.product;
    const existingImages = existingProduct.images || [];

    const seoHandle = metaTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")     
      .replace(/^-+|-+$/g, "")         
      .substring(0, 255);         

    const updatedProductData = {
      product: {
        id: productId,
        body_html: newDescription || existingProduct.body_html,
        handle: seoHandle
      }
    };

    const updateResponse = await axios.put(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}.json`,
      updatedProductData,
      { headers }
    );

    console.log(`Product description updated for Product ID: ${productId}`);

    if (existingImages.length > 0) {
      for (const image of existingImages) {
        const updatedImageData = {
          image: {
            id: image.id,
            alt: metaTitle
          }
        };

        await axios.put(
          `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/images/${image.id}.json`,
          updatedImageData,
          { headers }
        );

        console.log(`Image ID ${image.id} alt text updated to: "${metaTitle}"`);
      }
    } else {
      console.log(`No images found for Product ID: ${productId}. Skipping alt text update.`);
    }

    return { success: true, updatedProduct: updateResponse.data.product };

  } catch (error) {
    console.error(` Error updating product details for Product ID ${productId}:`, error.message);
    return { error: error.message };
  }
};


//Fetch Product with metafield
const fetchMetafields = async () => {
  try {
    const products = await fetchAllProducts();
    const metafieldsList = [];
    const BATCH_SIZE = 20;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      const metafieldRequests = batch.map(async (product) => {
        let retryCount = 0;
        let success = false;

        while (!success && retryCount < 5) {
          try {
            const response = await axios.get(
              `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${product.product_id}/metafields.json`,
              { headers }
            );

            const metafields = response.data.metafields;

            const titleMetafield = metafields.find(
              (meta) => meta.namespace === "global" && meta.key === "title_tag"
            );

            const descriptionMetafield = metafields.find(
              (meta) => meta.namespace === "global" && meta.key === "description_tag"
            );

            if (titleMetafield) {
              metafieldsList.push({
                product_id: product.product_id,
                key: "title_tag",
                value: titleMetafield.value,
              });
            }

            if (descriptionMetafield) {
              metafieldsList.push({
                product_id: product.product_id,
                key: "description_tag",
                value: descriptionMetafield.value,
              });
            }

            success = true;
          } catch (error) {
            if (error.response && error.response.status === 429) {
              retryCount++;
              const waitTime = Math.pow(2, retryCount) * 1000; // Exponential backoff (2s, 4s, 8s...)
              console.warn(`Rate limit hit. Retrying product ${product.product_id} in ${waitTime / 1000}s...`);
              await delay(waitTime);
            } else {
              console.error(`Error fetching metafields for product ${product.product_id}:`, error.message);
              break; // Exit retry loop if it's not a 429 error
            }
          }
        }
      });

      await Promise.all(metafieldRequests);
      console.log(`Processed ${i + BATCH_SIZE} products so far...`);

      await delay(2000);
    }

    console.log("Finished fetching metafields!");
    return metafieldsList;
  } catch (error) {
    console.error("Error:", error);
  }
};

//fetch particlar category products
const fetchCategoryProducts = async (collectionid) => {
  let url = `https://${SHOPIFY_STORE}/admin/api/2025-04/collects.json?collection_id=${collectionid}&limit=250`;
  const allCollects = [];

  try {
    while (url) {
      const response = await axios.get(url, { headers });

      console.log(`Fetched ${response.data.collects.length} products from Shopify`);

      allCollects.push(...response.data.collects);

      const linkHeader = response.headers.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        url = linkHeader.match(/<([^>]+)>;\s*rel="next"/)[1];
      } else {
        url = null;
      }
    }
    console.log(`Total products fetched: ${allCollects.length}`);
    return allCollects;
  } catch (error) {
    console.error("Error fetching products:", error.response ? error.response.data : error.message);
    return null;
  }
};

// Update product price
const updateVariantPrice = async (variantId, newPrice) => {
  const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`;

  try {
    console.log("Sending data to update price:", { variant: { id: variantId, price: newPrice } });
    await axios.put(SHOPIFY_GRAPHQL_URL, { 
      variant: { 
        id: variantId, 
        price: newPrice, 
        inventory_policy: "deny" 
      } 
    }, { headers });
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
    console.error(`Error adding Product ID: ${productId} to Collection: ${error.response ? JSON.stringify(error.response.data, null, 2) : error.message}`);
  }
};

const bulknewsmartcollection = async () => {
  const url = `https://{store}.myshopify.com/admin/api/{version}/smart_collections.json`;
  for (const collection of collections) {
    try {
      const response = await axios.post(
        url,
        { smart_collection: { ...collection, published: true } },
        { headers }
      );
      console.log(`Created: ${response.data.smart_collection.title}`);
    } catch (error) {
      console.error('Error creating collection:', error.response?.data || error.message);
    }
  }
}

const reorderSmartCollection = async (collectionId,productId,rank) => {
   const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

   const query = `
    mutation collectionReorderProducts($id: ID!, $moves: [MoveInput!]!) {
      collectionReorderProducts(id: $id, moves: $moves) {
        job { id done }
        userErrors { field message }
      }
    }`;

    const variables = {
    id: `gid://shopify/Collection/${collectionId}`,
    moves: [
      {
        id: `gid://shopify/Product/${productId}`,
        newPosition: rank,
      },
    ],
  };
    
    try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
    } else if (data.data.collectionReorderProducts.userErrors.length > 0) {
      console.error('User Errors:', data.data.collectionReorderProducts.userErrors);
    } else {
      console.log('Reorder job started:', data.data.collectionReorderProducts.job);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


module.exports = { fetchAllProducts, updateVariantPrice, addProductToCollection, delay, fetchCategoryProducts, fetchMetafields ,updateSEOmetafield, reorderSmartCollection};

