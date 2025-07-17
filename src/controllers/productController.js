const { fetchAllProducts,fetchCategoryProducts,fetchMetafields, fetchAllCollections} = require("../services/shopifyService");
const { saveToCsv } = require("../services/csvService");
const { OUTPUT_CSV_PATH } = require("../config/config");
const uploadToDropbox = require('../utils/uploadToDropbox');
const path = require('path');

const downloadProducts = async (req, res) => {
  try {
    const fileName = 'ToysGiftsproduct.csv';
    const localDir = '/tmp'; 
    const localFilePath = path.join(localDir, fileName);
    const dropboxPath = `/exports/${fileName}`;

    const productData = await fetchAllProducts();
    await saveToCsv(productData, fileName, localDir);
    await uploadToDropbox(localFilePath, dropboxPath);
    res.download(localFilePath);

  } catch (error) {
    console.error("Error in downloadProducts:", error.message);
    res.status(500).send("Error downloading product data");
  }
};

module.exports = downloadProducts;


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
    const productData = await fetchMetafields();
    await saveToCsv(productData,"metafield.csv");
    res.download(`${OUTPUT_CSV_PATH}metafield.csv`);
  }catch(error){
    res.status(500).send("Error downloading Metafield product");
  }
}

const downloadSmartCollections = async (req, res) => {
  try {
    const productData = await fetchAllCollections();
    await saveToCsv(productData,"SmartCollection.csv");
    res.download(`${OUTPUT_CSV_PATH}SmartCollection.csv`);
  } catch (error) {
    res.status(500).send("Error downloading product data");
  }
};


module.exports = {downloadProducts,downloadCategoryProducts,downloadMetafieldproduct,downloadSmartCollections}