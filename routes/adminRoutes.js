const express = require("express");
const c = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/stats", c.getStats);
router.get("/users", c.getUsers);
router.patch("/users/:id/status", c.setUserStatus);
router.delete("/users/:id", c.deleteUser);
router.get("/orders", c.getAllOrders);
router.get("/payments", c.getAllPayments);

module.exports = router;
