const express = require("express");
const c = require("../controllers/paymentController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/create", protect, authorize("buyer"), c.createPayment);
router.post("/verify", protect, authorize("buyer"), c.verifyPayment);
router.get("/my", protect, authorize("buyer"), c.getMyPayments);

module.exports = router;
