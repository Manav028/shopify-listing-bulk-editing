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
  let url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?fields=id,title,variants,body_html,published_at,images&limit=250`;
  const allProducts = [];

  try {
    while (url) {
      const response = await axios.get(url, { headers });

      console.log(`Fetched ${response.data.products.length} products from Shopify`);
      const products = response.data.products;

      for (const product of products) {
        const imageCount = product.images ? product.images.length : 0;
        product.variants.forEach((variant) => {
          allProducts.push({
            product_id: product.id,
            variant_id: variant.id,
            sku: variant.sku,
            product_title: product.title,
            product_price: variant.price,
            product_description: product.body_html,
            published_at: product.published_at,
            image_count: imageCount
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

const fetchAllProductsVendor = async () => {
  let url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?fields=id,vendor,variants&limit=250`;
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
            vendor: product.vendor,
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

    await updateProductDetails(productId, product_description, meta_title)

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
        body_html: newDescription ?? existingProduct.body_html,
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
const updateVariantPrice = async (variantId, newPrice, compareAtPrice = null) => {
  const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variantId}.json`;

  try {
    const variantData = {
      id: variantId,
      price: newPrice,
    };

    if (compareAtPrice !== null && compareAtPrice !== "" && !isNaN(compareAtPrice)) {
      variantData.compare_at_price = compareAtPrice;
    }

    console.log("Sending data to update price:", { variant: variantData });

    await axios.put(SHOPIFY_GRAPHQL_URL, { variant: variantData }, { headers });

    console.log(`Price updated for Variant ID: ${variantId}`);
  } catch (error) {
    console.error(`Error updating variant ID ${variantId}:`, error.response ? error.response.data : error.message);

    if (await handleRateLimit(error)) {
      return updateVariantPrice(variantId, newPrice, compareAtPrice);
    }
  }
};

const updatePublishedDate = async (productId, publishDate) => {
  const SHOPIFY_URL = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}.json`;

  try {
    const [day, month, year] = publishDate.split("/");
    const shopifyDate = `${year}-${month}-${day}T00:00:00+00:00`;

    const payload = {
      product: {
        id: productId,
        published_at: shopifyDate
      }
    };

    console.log("Updating publish date:", payload);

    const response = await axios.put(SHOPIFY_URL, payload, { headers });

    console.log(`Published date updated for Product ID: ${productId}`);

    return response.data.product;

  } catch (error) {

    console.error(
      `Error updating publish date for Product ID ${productId}:`,
      error.response ? error.response.data : error.message
    );

    if (await handleRateLimit(error)) {
      return updatePublishedDate(productId, publishDate);
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

const reorderSmartCollection = async (collectionId, productId, rank) => {
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

const fetchAllCollections = async () => {
  const urlBase = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/smart_collections.json?fields=id,title,rules,disjunctive,body_html,image&limit=250`;
  const allCollections = [];
  let url = urlBase;

  while (url) {
    try {
      const response = await axios.get(url, { headers });

      const collections = response.data.smart_collections;

      console.log(`Fetched ${collections.length} smart collections`);


      collections.forEach((collection) => {

        allCollections.push({
          id: collection.id,
          title: collection.title,
          type: 'smart',
          rules: collection.rules,
          disjunctive: collection.disjunctive,
          body_html: collection.body_html,
          image: collection.image,
        });
      });

      url =
        response.headers.link && response.headers.link.includes('rel="next"')
          ? response.headers.link
            .split(',')
            .find((link) => link.includes('rel="next"'))
            .match(/<(.*?)>/)[1]
          : null;

    } catch (error) {
      console.error(`Error fetching ${url}:`, error.response?.data || error.message);
      throw new Error('Failed to fetch smart collections');
    }
  }

  console.log(`Total smart collections fetched: ${allCollections.length}`);
  return allCollections;
};

const createSmartCollection = async (vendorName) => {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

  const query = `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      title: `${z}`,
      ruleSet: {
        appliedDisjunctively: false,
        rules: [
          {
            column: "VENDOR",
            relation: "EQUALS",
            condition: vendorName.toString(),
          },
        ],
      },
    },
  };

  try {
    const response = await axios.post(
      url,
      { query, variables },
      {
        headers
      }
    );

    const { collectionCreate } = response.data.data;

    if (collectionCreate.userErrors.length > 0) {
      console.error("GraphQL Errors:", collectionCreate.userErrors);
    } else {
      console.log(`Smart collection created for vendor ${vendorName}: ${collectionCreate.collection.id}`);
    }
  } catch (error) {
    console.error(`Error creating smart collection for vendor ${vendorName}:`, error.response?.data || error.message);
  }
};

const updateProductVendor = async (productId, vendorName) => {
  try {
    console.log(`🔹 Updating vendor for Product ID: ${productId} to "${vendorName}"`);

    const response = await axios.put(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}.json`,
      {
        product: {
          id: productId,
          vendor: vendorName,
        },
      },
      { headers }
    );

    console.log(`Vendor updated to "${vendorName}" for Product ID: ${productId}`);
    return response.data.product;

  } catch (error) {
    console.error(`Error updating vendor for Product ID ${productId}:`, error.response?.data || error.message);
    throw error;
  }
};

// Create Smart cillection from JSON condition fwtch from rules
const createSmartCollectionWithJSON = async (title, rules, disjunctive = false, description) => {
  if (!title) throw new Error("Missing collection title.");
  if (!Array.isArray(rules)) throw new Error("Rules must be an array.");

  const url = `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/smart_collections.json`;

  const payload = {
    smart_collection: {
      title,
      rules,
      disjunctive,
      body_html: description
    }
  };

  try {
    const response = await axios.post(url, payload, {
      headers,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      console.log(`Smart collection created for ${rules}`);
      return response.data.smart_collection;
    }

    const apiError = JSON.stringify(response.data, null, 2);

    throw new Error(`Shopify API ${response.status}: ${apiError}`);

  } catch (err) {
    if (err.response) {
      throw new Error(
        `Shopify API ${err.response.status}: ${JSON.stringify(err.response.data)}`
      );
    }
    throw new Error(`Axios error: ${err.message}`);
  }
};

const migrateVendorRuleToMetafield = async (collectionId, metafieldDefinitionGID) => {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;
  const gid = `gid://shopify/Collection/${collectionId}`;

  try {
    console.log(`Processing collection ${collectionId}`);

    const getQuery = `
      query getCollection($id: ID!) {
        collection(id: $id) {
          id
          ruleSet {
            appliedDisjunctively
            rules {
              column
              relation
              condition
            }
          }
        }
      }
    `;

    const getResponse = await axios.post(url, { query: getQuery, variables: { id: gid } }, { headers });

    if (!getResponse.data || getResponse.data.errors) {
      console.error("GraphQL errors fetching collection:", getResponse.data.errors);
      return;
    }

    const collection = getResponse.data.data.collection;

    if (!collection?.ruleSet?.rules?.length) {
      console.log("No rules found. Skipping.");
      return;
    }

    const { appliedDisjunctively, rules } = collection.ruleSet;

    const vendorRule = rules.find(r => r.column === "VENDOR");

    if (!vendorRule) {
      console.log("No VENDOR rule found. Skipping.");
      return;
    }

    const vendorValue = vendorRule.condition;

    let updatedRules = rules.filter(r => r.column !== "VENDOR");

    updatedRules.push({
      column: "PRODUCT_METAFIELD_DEFINITION",
      relation: "EQUALS",
      condition: vendorValue,
      conditionObjectId: "gid://shopify/MetafieldDefinition/194143519069"
    });

    console.log("Updated rules:", updatedRules);

    const updateMutation = `
      mutation updateCollection($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateResponse = await axios.post(
      url,
      { query: updateMutation, variables: { input: { id: gid, ruleSet: { appliedDisjunctively, rules: updatedRules } } } },
      { headers }
    );

    if (!updateResponse.data) {
      console.error("No response from Shopify:", updateResponse);
      return;
    }

    if (updateResponse.data.errors) {
      console.error("GraphQL top-level errors:", updateResponse.data.errors);
      return;
    }

    const userErrors = updateResponse.data.data.collectionUpdate.userErrors;
    if (userErrors.length > 0) {
      console.error("GraphQL user errors:", userErrors);
      return;
    }

    console.log(`Collection ${collectionId} migrated successfully.`);

  } catch (error) {
    console.error(`Error migrating collection ${collectionId}:`, error.response?.data || error.message);
  }
};

const fetchProductMetafields = async (productId) => {
 try {
    const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/metafields.json`;
    const response = await axios.get(url, { headers });

    if (!response.data || !response.data.metafields) return {};

    // Convert to { namespace.key: value } format for easy access
    const values = {};
    response.data.metafields.forEach(meta => {
      values[`${meta.namespace}.${meta.key}`] = meta.value;
    });
    console.log(`Fetched metafields for product ${productId}:`, values);

    return values;
  } catch (error) {
    console.error(`Error fetching metafields for product ${productId}:`, error.response?.data || error.message);
    return {};
  }
};

const updateItemManufacturesMetafield = async (productId, value) => {
  const url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: `gid://shopify/Product/${productId}`,
        namespace: "custom", // Change if your namespace is different
        key: "item_manufactures",
        type: "single_line_text_field", // Change if your definition uses a different type
        value: value.toString(),
      },
    ],
  };

  try {
    const response = await axios.post(
      url,
      { query: mutation, variables },
      { headers }
    );

    if (response.data.errors) {
      console.error("GraphQL Errors:", response.data.errors);
      return;
    }

    const userErrors = response.data.data.metafieldsSet.userErrors;
    if (userErrors.length > 0) {
      console.error("User Errors:", userErrors);
      return;
    }

    console.log(
      `Metafield 'item_manufactures' updated successfully for Product ID: ${productId}`
    );

    return response.data.data.metafieldsSet.metafields[0];

  } catch (error) {
    console.error(
      `Error updating metafield for Product ID ${productId}:`,
      error.response?.data || error.message
    );
  }
};

const createProduct = async (title, sku, price = "0.00", chargeTax = true) => {
  try {
    const payload = {
      product: {
        title,
        variants: [
          {
            sku,
            price,
            taxable: chargeTax
          }
        ]
      }
    };

    const response = await axios.post(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json`,
      payload,
      { headers }
    );

    console.log(`Product created: ${response.data.product.id}`);

    return {
      success: true,
      product: response.data.product
    };

  } catch (error) {
    console.error(
      "Error creating product:",
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

const uploadProductImage = async (productId, imageUrl, altText = "") => {
  try {
    const response = await axios.post(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}/images.json`,
      {
        image: {
          src: imageUrl,
          alt: altText
        }
      },
      { headers }
    );

    console.log(
      `Image uploaded for Product ${productId}: ${response.data.image.id}`
    );

    return response.data.image;

  } catch (error) {
    console.error(
      `Image upload failed for Product ${productId}:`,
      error.response?.data || error.message
    );
  }
};

const deleteProduct = async (productId) => {
  try {
    await axios.delete(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products/${productId}.json`,
      { headers }
    );

    console.log(`Deleted product ${productId}`);

    return { success: true };

  } catch (error) {
    console.error(
      `Failed deleting product ${productId}:`,
      error.response?.data || error.message
    );

    return { success: false, error: error.message };
  }
};

const fetchAllProductImageUrls = async () => {
  let url = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/products.json?fields=images&limit=250`;
  const imageUrls = new Set();

  try {
    while (url) {
      let success = false;
      let retryCount = 0;

      while (!success && retryCount < 5) {
        try {
          const response = await axios.get(url, { headers });

          response.data.products.forEach((product) => {
            (product.images || []).forEach((image) => {
              if (image.src) {
                imageUrls.add(image.src.split("?")[0]);
              }
            });
          });

          url =
            response.headers.link &&
            response.headers.link.includes('rel="next"')
              ? response.headers.link
                  .split(",")
                  .find((link) => link.includes('rel="next"'))
                  .match(/<(.*?)>/)[1]
              : null;

          success = true;
        } catch (error) {
          if (error.response && error.response.status === 429) {
            retryCount++;
            const retryAfter = error.response.headers["retry-after"] || Math.pow(2, retryCount);
            console.warn(`Rate limited on image URLs. Retrying in ${retryAfter}s...`);
            await delay(retryAfter * 1000);
          } else {
            throw error;
          }
        }
      }

      // Throttle: stay well under 2 req/sec
      await delay(600);
    }

    return imageUrls;
  } catch (error) {
    console.error(
      "Error fetching product image URLs:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const fetchAllFiles = async () => {
  const allFiles = [];
  let hasNextPage = true;
  let cursor = null;

  try {
    while (hasNextPage) {
      const query = `
      query ($cursor: String) {
        files(first: 250, after: $cursor) {
          edges {
            cursor
            node {
              id
              ... on MediaImage {
                image {
                  url
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }`;

      let success = false;
      let retryCount = 0;

      while (!success && retryCount < 5) {
        try {
          const response = await axios.post(
            `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
            { query, variables: { cursor } },
            { headers }
          );

          // GraphQL rate limit errors come back as 200 with errors in the body
          if (response.data.errors) {
            const isThrottled = JSON.stringify(response.data.errors)
              .toLowerCase()
              .includes("throttl");

            if (isThrottled) {
              retryCount++;
              const waitTime = Math.pow(2, retryCount) * 1000;
              console.warn(`GraphQL throttled on files. Retrying in ${waitTime / 1000}s...`);
              await delay(waitTime);
              continue;
            }

            throw new Error(JSON.stringify(response.data.errors));
          }

          const files = response.data.data.files.edges;

          files.forEach((edge) => {
            allFiles.push({
              id: edge.node.id,
              url: edge.node.image?.url
                ? edge.node.image.url.split("?")[0]
                : null,
            });
          });

          hasNextPage = response.data.data.files.pageInfo.hasNextPage;

          if (files.length > 0) {
            cursor = files[files.length - 1].cursor;
          }

          success = true;
        } catch (error) {
          if (error.response && error.response.status === 429) {
            retryCount++;
            const retryAfter = error.response.headers["retry-after"] || Math.pow(2, retryCount);
            console.warn(`Rate limited on files. Retrying in ${retryAfter}s...`);
            await delay(retryAfter * 1000);
          } else {
            throw error;
          }
        }
      }

      // Throttle between pages
      await delay(600);
    }

    return allFiles;
  } catch (error) {
    console.error(
      "Error fetching files:",
      error.response?.data || error.message
    );
    throw error;
  }
};

const deleteFilesBatch = async (fileIds) => {
  const mutation = `
    mutation fileDelete($fileIds: [ID!]!) {
      fileDelete(fileIds: $fileIds) {
        deletedFileIds
        userErrors {
          field
          message
        }
      }
    }
  `;

  let retryCount = 0;

  while (retryCount < 5) {
    try {
      const response = await axios.post(
        `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`,
        { query: mutation, variables: { fileIds } },
        { headers }
      );

      // Check for GraphQL-level throttling (200 status but errors in body)
      if (response.data.errors) {
        const isThrottled = JSON.stringify(response.data.errors)
          .toLowerCase()
          .includes("throttl");

        if (isThrottled) {
          retryCount++;
          const waitTime = Math.pow(2, retryCount) * 1000;
          console.warn(`GraphQL throttled on delete batch. Retrying in ${waitTime / 1000}s...`);
          await delay(waitTime);
          continue;
        }

        throw new Error(JSON.stringify(response.data.errors));
      }

      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 429) {
        retryCount++;
        const retryAfter = error.response.headers["retry-after"] || Math.pow(2, retryCount);
        console.warn(`Rate limited on delete batch. Retrying in ${retryAfter}s...`);
        await delay(retryAfter * 1000);
      } else {
        throw error;
      }
    }
  }

  throw new Error("Max retries exceeded for deleteFilesBatch");
};

const deleteUnusedProductFiles = async () => {
  try {
    console.log("Fetching product image URLs...");
    const productImages = await fetchAllProductImageUrls();

    console.log(`Found ${productImages.size} product images`);

    console.log("Fetching Shopify files...");
    const files = await fetchAllFiles();

    console.log(`Found ${files.length} files`);

    const unusedFiles = files.filter((file) => {
      if (!file.url) return false;
      return !productImages.has(file.url);
    });

    console.log(
      `Found ${unusedFiles.length} files not associated with products`
    );

    const deleted = [];

    for (let i = 0; i < unusedFiles.length; i += 50) {
      const batch = unusedFiles
        .slice(i, i + 50)
        .map((file) => file.id);

      const result = await deleteFilesBatch(batch);

      console.log(
        `Deleted batch ${Math.floor(i / 50) + 1}`
      );

      deleted.push(...batch);

      await delay(1000);
    }

    return {
      success: true,
      totalFiles: files.length,
      totalProductImages: productImages.size,
      deletedCount: deleted.length,
    };
  } catch (error) {
    console.error(
      "Error deleting unused files:",
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
};

//Metafield Bulk Fetching using GraphQL Bulk Operations API
const fetchAllProductMetafieldsBulk = async () => {
  const graphqlUrl = `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/graphql.json`;

  //Kick off a bulk operation
  const bulkMutation = `
    mutation {
      bulkOperationRunQuery(
        query: """
        {
          products {
            edges {
              node {
                id
                title
                metafields {
                  edges {
                    node {
                      namespace
                      key
                      value
                      type
                    }
                  }
                }
              }
            }
          }
        }
        """
      ) {
        bulkOperation {
          id
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  console.log("Starting bulk operation...");

  const mutationResponse = await axios.post(
    graphqlUrl,
    { query: bulkMutation },
    { headers }
  );

  const { bulkOperation, userErrors } =
    mutationResponse.data.data.bulkOperationRunQuery;

  if (userErrors?.length > 0) {
    throw new Error(`Bulk operation errors: ${JSON.stringify(userErrors)}`);
  }

  console.log(`Bulk operation started. ID: ${bulkOperation.id}`);

  //Poll until complete
  const pollQuery = `
    {
      currentBulkOperation {
        id
        status
        errorCode
        objectCount
        fileSize
        url
        partialDataUrl
      }
    }
  `;

  let downloadUrl = null;

  while (true) {
    await delay(5000);

    const pollResponse = await axios.post(
      graphqlUrl,
      { query: pollQuery },
      { headers }
    );

    const op = pollResponse.data.data.currentBulkOperation;
    console.log(`Bulk operation status: ${op.status} | Objects: ${op.objectCount}`);

    if (op.status === "COMPLETED") {
      downloadUrl = op.url;
      console.log(`Bulk operation complete. File URL: ${downloadUrl}`);
      break;
    }

    if (op.status === "FAILED" || op.status === "CANCELED") {
      throw new Error(`Bulk operation failed: ${op.errorCode}`);
    }
  }

  if (!downloadUrl) {
    throw new Error("No download URL returned from bulk operation.");
  }

  //Download and parse the JSONL file
  console.log("Downloading bulk result file...");

  const fileResponse = await axios.get(downloadUrl, {
    responseType: "stream",
  });

  // Build a map: productId -> { title, metafields: [] }
  const productMap = new Map();
  const metafieldRows = [];

  await new Promise((resolve, reject) => {
    const readline = require("readline");
    const rl = readline.createInterface({ input: fileResponse.data });

    rl.on("line", (line) => {
      if (!line.trim()) return;

      const obj = JSON.parse(line);

      if (obj.id?.includes("/Product/") && !obj.__parentId) {
        // Top-level product node
        productMap.set(obj.id, {
          product_gid: obj.id,
          product_id: obj.id.replace("gid://shopify/Product/", ""),
          product_title: obj.title,
        });
      } else if (obj.__parentId) {
        // Child node — metafield belonging to a product
        const parent = productMap.get(obj.__parentId);
        if (parent) {
          metafieldRows.push({
            product_id: parent.product_id,
            product_title: parent.product_title,
            namespace: obj.namespace,
            key: obj.key,
            value: obj.value,
            type: obj.type,
          });
        }
      }
    });

    rl.on("close", resolve);
    rl.on("error", reject);
  });

  console.log(
    `Parsed ${productMap.size} products and ${metafieldRows.length} metafield entries.`
  );

  return metafieldRows;
};

const updateSmartCollectionImage = async (collectionId, imageUrl, altText = "") => {
  try {
    const response = await axios.put(
      `https://${SHOPIFY_STORE}/admin/api/${API_VERSION}/smart_collections/${collectionId}.json`,
      {
        smart_collection: {
          id: collectionId,
          image: {
            src: imageUrl,
            alt: altText
          }
        }
      },
      { headers }
    );

    console.log(
      `Image updated for Smart Collection ${collectionId}`
    );

    return response.data.smart_collection;

  } catch (error) {
    console.error(
      `Failed updating Smart Collection ${collectionId}:`,
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = { deleteProduct,fetchAllProducts, updateVariantPrice, addProductToCollection, delay, fetchCategoryProducts, fetchMetafields, updateSEOmetafield, reorderSmartCollection, fetchAllCollections, createSmartCollection, updateProductVendor, createSmartCollectionWithJSON, migrateVendorRuleToMetafield , fetchProductMetafields, fetchAllProductsVendor, updateItemManufacturesMetafield, updatePublishedDate,createProduct, uploadProductImage, deleteUnusedProductFiles, fetchAllProductMetafieldsBulk, updateSmartCollectionImage};