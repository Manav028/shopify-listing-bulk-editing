const express = require("express");
const { downloadProducts,downloadCategoryProducts,downloadMetafieldproduct } = require("../controllers/productController");
const {openaiSEO} = require("../services/openaiService")
const {reorderSmartCollection} = require("../services/shopifyService")
const router = express.Router();

router.get("/download-products", downloadProducts);
router.get("/category-products", downloadCategoryProducts);
router.get("/metafield-products",downloadMetafieldproduct);
// router.get("/trial",openaiSEO);  openaiSEO direct link for trial version
router.post("/trialsort", async (req, res) => {
  try {
    await reorderSmartCollection(); // Call your function
    res.status(200).json({ message: "Reorder request sent successfully." });
  } catch (error) {
    console.error("Error in /trialsort:", error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;



