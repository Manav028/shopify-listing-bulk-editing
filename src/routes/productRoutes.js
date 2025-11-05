const express = require("express");
const { downloadProducts,downloadCategoryProducts,downloadMetafieldproduct,downloadSmartCollections ,compareSKUsdaily} = require("../controllers/productController");
const {openaiSEO} = require("../services/openaiService")
const {reorderSmartCollection} = require("../services/shopifyService")
const router = express.Router();

router.get("/download-products", downloadProducts);
router.get("/category-products", downloadCategoryProducts);
router.get("/metafield-products",downloadMetafieldproduct);
router.get("/getcollection",downloadSmartCollections);
router.get("/CompareSKU",compareSKUsdaily);

// router.get("/trial",openaiSEO);  openaiSEO direct link for trial version

module.exports = router;



