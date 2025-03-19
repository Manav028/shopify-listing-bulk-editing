const express = require("express");
const { downloadProducts } = require("../controllers/productController");
const router = express.Router();

router.get("/download-products", downloadProducts);

module.exports = router;
