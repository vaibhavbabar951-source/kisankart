const express = require("express");
const c = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, authorize("buyer"), c.createOrder);
router.get("/my", protect, authorize("buyer"), c.getMyOrders);
router.get("/farmer", protect, authorize("farmer"), c.getFarmerOrders);
router.get("/:id", protect, c.getOrderById);
router.put("/:id/cancel", protect, authorize("buyer"), c.cancelOrder);
router.put("/:id/status", protect, authorize("farmer", "admin"), c.updateOrderStatus);

module.exports = router;
