const User = require("../models/User");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const { deleteUploadedFile } = require("../utils/file");

const paging = (req) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

// GET /api/admin/stats
const getStats = async (req, res) => {
  const [farmers, buyers, products, orders, ordersByStatus, revenue] = await Promise.all([
    User.countDocuments({ role: "farmer" }),
    User.countDocuments({ role: "buyer" }),
    Product.countDocuments(),
    Order.countDocuments(),
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);

  res.json({
    farmers,
    buyers,
    products,
    orders,
    ordersByStatus: Object.fromEntries(ordersByStatus.map((s) => [s._id, s.count])),
    revenue: revenue[0]?.total || 0,
  });
};

// GET /api/admin/users?role=farmer&search=ram&page=1&limit=20
const getUsers = async (req, res) => {
  const { page, limit, skip } = paging(req);
  const filter = {};
  if (req.query.role) filter.role = req.query.role;
  if (req.query.search) {
    const safe = req.query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: { $regex: safe, $options: "i" } }, { email: { $regex: safe, $options: "i" } }];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  res.json({ total, page, pages: Math.ceil(total / limit), users });
};

// PATCH /api/admin/users/:id/status   body: { isActive: true|false }
const setUserStatus = async (req, res) => {
  const { isActive } = req.body || {};
  if (typeof isActive !== "boolean") {
    return res.status(400).json({ msg: "isActive (true/false) is required" });
  }

  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (user.role === "admin") return res.status(403).json({ msg: "Cannot change an admin" });

  user.isActive = isActive;
  await user.save();
  res.json({ msg: isActive ? "User unblocked" : "User blocked", user });
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ msg: "User not found" });
  if (user.role === "admin") return res.status(403).json({ msg: "Cannot delete an admin" });

  if (user.role === "farmer") {
    const products = await Product.find({ farmer: user._id }).select("image");
    products.forEach((p) => deleteUploadedFile(p.image));
    await Product.deleteMany({ farmer: user._id });
  }
  deleteUploadedFile(user.profileImage);
  await user.deleteOne();
  res.json({ msg: "User deleted" });
};

// GET /api/admin/orders?status=pending
const getAllOrders = async (req, res) => {
  const { page, limit, skip } = paging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter).populate("buyer", "name email phone").sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  res.json({ total, page, pages: Math.ceil(total / limit), orders });
};

// GET /api/admin/payments?status=paid
const getAllPayments = async (req, res) => {
  const { page, limit, skip } = paging(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;

  const [total, payments] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter).populate("buyer", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  res.json({ total, page, pages: Math.ceil(total / limit), payments });
};

module.exports = { getStats, getUsers, setUserStatus, deleteUser, getAllOrders, getAllPayments };
