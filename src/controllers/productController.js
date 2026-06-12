const { fetchAllProducts,fetchCategoryProducts,fetchMetafields, fetchAllCollections,fetchProductMetafields, fetchAllProductsVendor, deleteUnusedProductFiles, fetchAllProductMetafieldsBulk} = require("../services/shopifyService");
const { saveToCsv } = require("../services/csvService");
const { OUTPUT_CSV_PATH , STORE_NAME } = require("../config/config");
const {uploadToDropbox} = require('../utils/uploadToDropbox');
const path = require('path');
const {compareSKUs} = require("../services/compareSKUs")
const { getFilePaths } = require("../utils/filePaths");

const downloadProducts = async (req, res) => {
  try {
    const fileName = `${STORE_NAME}products.csv`;

    const { localDir, localFilePath, dropboxPath } = getFilePaths(fileName);

    const productData = await fetchAllProducts();
    await saveToCsv(productData, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);
    res.download(localFilePath);
  } catch (error) {
    console.error("Error in downloadProducts:", error.message);
    res.status(500).send("Error downloading product data");
  }
};

const downloadCategoryProducts = async (req, res) => {
  try {
    const productData = await fetchCategoryProducts(652024742237);
    await saveToCsv(productData,"Categorydata.csv");
    res.download(`${OUTPUT_CSV_PATH}Categorydata.csv`);
  } catch (error) {
    res.status(500).send("Error downloading product data");
  }
};

const downloadMetafieldproduct = async(req,res) =>{
  try{
    const fileName = `${STORE_NAME}Metafield.csv`;

    const { localDir, localFilePath, dropboxPath } = getFilePaths(fileName);

    const productData = await fetchMetafields();
    await saveToCsv(productData, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);
    res.download(localFilePath);
  }catch(error){
    res.status(500).send("Error downloading Metafield product");
  }
}

const downloadSmartCollections = async (req, res) => {
  try {

    const fileName = `${STORE_NAME}SmartCollections.csv`;

    const { localDir, localFilePath, dropboxPath } = getFilePaths(fileName);

    const productData = await fetchAllCollections();
    await saveToCsv(productData, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);
    res.download(localFilePath);
  }catch (error) {
    console.error("Error in downloadSmartCollections:", error.message);
    res.status(500).send("Error download Smart Collections data");
  }
};

const compareSKUsdaily = async(req,res) => {
  try{
    const SKUdata = await compareSKUs("/Outbound/peglabel.csv")
    res.json({ success: true, message: "Comparison completed & uploaded." });
  }catch(error){
    res.status(500).json({ success: false, error: err.message });
  }
}

const fetchProductMetafield = async (req, res) => {
  try {
    const { productId } = req.params;
    const metafields = await fetchProductMetafields(productId);
    res.json(metafields);
  } catch (error) {
    console.error("Error fetching product metafields:", error.message);
    res.status(500).send("Error fetching product metafields");
  }
}

const fetchproductVendor = async (req, res) => {
  try {
    const fileName = `${STORE_NAME}Vendor.csv`;

    const { localDir, localFilePath, dropboxPath } = getFilePaths(fileName);

    const productData = await fetchAllProductsVendor();
    await saveToCsv(productData, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);
    res.download(localFilePath);
  } catch (error) {
    console.error("Error in fetchproductVendor:", error.message);
    res.status(500).send("Error downloading product vendor data");
  }
}

const deleteUnusedImages = async (req, res) => {
  try {
    const result = await deleteUnusedProductFiles();

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

const downloadAllMetafieldsBulk = async (req, res) => {
  try {
    const fileName = `${STORE_NAME}MetafieldsBulk.csv`;
    const { localDir, localFilePath, dropboxPath } = getFilePaths(fileName);

    const data = await fetchAllProductMetafieldsBulk();
    await saveToCsv(data, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);

    res.download(localFilePath);
  } catch (error) {
    console.error("Error in downloadAllMetafieldsBulk:", error.message);
    res.status(500).send("Error downloading bulk metafields");
  }
};


module.exports = {downloadProducts,downloadCategoryProducts,downloadMetafieldproduct,downloadSmartCollections,compareSKUsdaily,fetchProductMetafield,fetchproductVendor,deleteUnusedImages,downloadAllMetafieldsBulk};