const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const UPLOAD_ROOT = path.join(ROOT, "uploads");

// publicPath looks like "/uploads/products/abc.jpg"
const deleteUploadedFile = (publicPath) => {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;
  const full = path.join(ROOT, publicPath);
  if (!full.startsWith(UPLOAD_ROOT)) return; // safety: never delete outside uploads
  fs.unlink(full, () => {});
};

module.exports = { deleteUploadedFile };
