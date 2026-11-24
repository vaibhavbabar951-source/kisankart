const multer = require("multer");

const notFound = (req, res) => {
  res.status(404).json({ msg: `Route not found: ${req.method} ${req.originalUrl}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "Image too large (max 2 MB)" : err.message;
    return res.status(400).json({ msg });
  }
  if (err.isUploadError) return res.status(400).json({ msg: err.message });
  if (err.name === "ValidationError") {
    const msg = Object.values(err.errors).map((e) => e.message).join(", ");
    return res.status(400).json({ msg });
  }
  if (err.name === "CastError") return res.status(400).json({ msg: "Invalid id or value" });
  if (err.code === 11000) return res.status(409).json({ msg: "Duplicate value, already exists" });

  console.error(err);
  res.status(500).json({ msg: "Server error" });
};

module.exports = { notFound, errorHandler };
