const express = require("express");
const { downloadProducts,downloadCategoryProducts,downloadSmartCollections ,compareSKUsdaily,fetchProductMetafield,fetchproductVendor,deleteUnusedImages,downloadAllMetafieldsBulk} = require("../controllers/productController");
const {openaiSEO} = require("../services/openaiService")
const {reorderSmartCollection} = require("../services/shopifyService")
const router = express.Router();

router.get("/download-products", downloadProducts);
router.get("/category-products", downloadCategoryProducts);
router.get("/getcollection",downloadSmartCollections);
router.get("/CompareSKU",compareSKUsdaily);
router.get("/fetchMetafields",fetchProductMetafield);
router.get("/fetchproductVendor",fetchproductVendor);
router.delete("/delete-unused-product-files",deleteUnusedImages);
router.get("/download-all-metafields-bulk", downloadAllMetafieldsBulk);
// router.get("/trial",openaiSEO);  openaiSEO direct link for trial version

module.exports = router;