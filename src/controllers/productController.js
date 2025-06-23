const { fetchAllProducts,fetchCategoryProducts,fetchMetafields } = require("../services/shopifyService");
const { saveToCsv } = require("../services/csvService");
const { OUTPUT_CSV_PATH } = require("../config/config");

const downloadProducts = async (req, res) => {
  try {
    const productData = await fetchAllProducts();
    await saveToCsv(productData,"product.csv");
    res.download(`${OUTPUT_CSV_PATH}product.csv`);
  } catch (error) {
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
    const productData = await fetchMetafields();
    await saveToCsv(productData,"metafield.csv");
    res.download(`${OUTPUT_CSV_PATH}metafield.csv`);
  }catch(error){
    res.status(500).send("Error downloading Metafield product");
  }
}

module.exports = {downloadProducts,downloadCategoryProducts,downloadMetafieldproduct}