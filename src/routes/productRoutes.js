const express = require("express");
const { downloadProducts,downloadCategoryProducts,downloadMetafieldproduct } = require("../controllers/productController");
const {openaiSEO} = require("../services/openaiService")
const router = express.Router();

router.get("/download-products", downloadProducts);
router.get("/category-products", downloadCategoryProducts);
router.get("/metafield-products",downloadMetafieldproduct);
// router.get("/trial",openaiSEO);  openaiSEO direct link for trial version

module.exports = router;



