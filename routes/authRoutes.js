const express = require("express");
const c = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");
const { uploadProfile } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.post("/signup", uploadProfile, c.signup); // image optional
router.post("/login", c.login);

router.get("/me", protect, c.getMe);
router.put("/me", protect, c.updateProfile);
router.put("/me/image", protect, uploadProfile, c.uploadProfileImage);
router.delete("/me/image", protect, c.removeProfileImage);
router.put("/me/password", protect, c.changePassword);

module.exports = router;
