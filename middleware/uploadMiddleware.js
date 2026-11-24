const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// Form field name for the file must be "image"
const makeUploader = (folder) => {
  const dir = path.join(__dirname, "..", "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${EXT[file.mimetype]}`),
  });

  const fileFilter = (req, file, cb) => {
    if (EXT[file.mimetype]) return cb(null, true);
    const err = new Error("Only JPG, PNG or WEBP images are allowed");
    err.isUploadError = true;
    cb(err);
  };

  return multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024, files: 1 } }).single("image");
};

module.exports = {
  uploadProfile: makeUploader("profiles"),
  uploadProduct: makeUploader("products"),
};
