const express = require("express");
const c = require("../controllers/productController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { uploadProduct } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", c.getProducts);
router.get("/my", protect, authorize("farmer"), c.getMyProducts); // must be before /:id
router.get("/:id", c.getProductById);

router.post("/", protect, authorize("farmer"), uploadProduct, c.createProduct);
router.put("/:id", protect, authorize("farmer"), uploadProduct, c.updateProduct);
router.delete("/:id/image", protect, authorize("farmer"), c.removeProductImage);
router.delete("/:id", protect, authorize("farmer", "admin"), c.deleteProduct);

module.exports = router;
