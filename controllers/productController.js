const Product = require("../models/Product");
const { deleteUploadedFile } = require("../utils/file");

const FARMER_FIELDS = "name phone profileImage address.city address.state";

// POST /api/products  (farmer) - JSON or multipart/form-data with optional "image"
const createProduct = async (req, res) => {
  const uploaded = req.file ? `/uploads/products/${req.file.filename}` : "";

  try {
    const { name, category, description, price, unit, quantity } = req.body || {};

    if (!name || !category || price == null || price === "" || quantity == null || quantity === "") {
      deleteUploadedFile(uploaded);
      return res.status(400).json({ msg: "name, category, price and quantity are required" });
    }

    const product = await Product.create({
      farmer: req.user.id,
      name,
      category,
      description,
      price,
      unit,
      quantity,
      image: uploaded,
    });

    res.status(201).json({ msg: "Product created", product });
  } catch (err) {
    deleteUploadedFile(uploaded);
    throw err;
  }
};

// GET /api/products  (public)
// ?category=fruits&search=mango&minPrice=10&maxPrice=200&farmer=<id>&page=1&limit=12
const getProducts = async (req, res) => {
  const { category, search, minPrice, maxPrice, farmer } = req.query;
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 50);

  const filter = { isAvailable: true };
  if (category) filter.category = category;
  if (farmer) filter.farmer = farmer;
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.name = { $regex: safe, $options: "i" };
  }
  if (minPrice || maxPrice) {
    filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
  }

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .populate("farmer", FARMER_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({ total, page, pages: Math.ceil(total / limit), count: products.length, products });
};

// GET /api/products/my  (farmer)
const getMyProducts = async (req, res) => {
  const products = await Product.find({ farmer: req.user.id }).sort({ createdAt: -1 });
  res.json({ count: products.length, products });
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  const product = await Product.findById(req.params.id).populate("farmer", FARMER_FIELDS);
  if (!product) return res.status(404).json({ msg: "Product not found" });
  res.json(product);
};

// PUT /api/products/:id  (owner farmer) - JSON or multipart with optional "image"
const updateProduct = async (req, res) => {
  const uploaded = req.file ? `/uploads/products/${req.file.filename}` : "";

  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      deleteUploadedFile(uploaded);
      return res.status(404).json({ msg: "Product not found" });
    }
    if (product.farmer.toString() !== req.user.id) {
      deleteUploadedFile(uploaded);
      return res.status(403).json({ msg: "You can only edit your own products" });
    }

    const body = req.body || {};
    ["name", "category", "description", "price", "unit", "quantity", "isAvailable"].forEach((f) => {
      if (body[f] !== undefined) product[f] = body[f];
    });

    const oldImage = product.image;
    if (uploaded) product.image = uploaded;

    await product.save();
    if (uploaded) deleteUploadedFile(oldImage);

    res.json({ msg: "Product updated", product });
  } catch (err) {
    deleteUploadedFile(uploaded);
    throw err;
  }
};

// DELETE /api/products/:id/image  (owner farmer)
const removeProductImage = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ msg: "Product not found" });
  if (product.farmer.toString() !== req.user.id) {
    return res.status(403).json({ msg: "You can only edit your own products" });
  }

  deleteUploadedFile(product.image);
  product.image = "";
  await product.save();
  res.json({ msg: "Product image removed" });
};

// DELETE /api/products/:id  (owner farmer or admin)
const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ msg: "Product not found" });
  if (product.farmer.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ msg: "Not allowed to delete this product" });
  }

  deleteUploadedFile(product.image);
  await product.deleteOne();
  res.json({ msg: "Product deleted" });
};

module.exports = {
  createProduct,
  getProducts,
  getMyProducts,
  getProductById,
  updateProduct,
  removeProductImage,
  deleteProduct,
};
