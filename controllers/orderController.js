const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

// Allowed status changes
const STATUS_FLOW = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const restoreStock = async (items) => {
  for (const it of items) {
    await Product.updateOne(
      { _id: it.product },
      { $inc: { quantity: it.quantity }, $set: { isAvailable: true } }
    );
  }
};

const isFarmerOfOrder = (order, userId) =>
  order.items.some((i) => i.farmer.toString() === userId);

// POST /api/orders  (buyer)
// body: { items: [{productId, quantity}], shippingAddress: {...}, paymentMethod: "cod" | "online" }
const createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod = "cod" } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ msg: "items are required" });
  }
  if (!["cod", "online"].includes(paymentMethod)) {
    return res.status(400).json({ msg: "paymentMethod must be cod or online" });
  }
  const required = ["fullName", "phone", "address", "city", "state", "pincode"];
  if (!shippingAddress || required.some((f) => !shippingAddress[f])) {
    return res.status(400).json({ msg: `shippingAddress needs: ${required.join(", ")}` });
  }

  // Merge duplicate products and validate
  const wanted = new Map();
  for (const it of items) {
    const qty = Number(it.quantity);
    if (!mongoose.isValidObjectId(it.productId) || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ msg: "Each item needs a valid productId and quantity > 0" });
    }
    const key = String(it.productId);
    wanted.set(key, (wanted.get(key) || 0) + qty);
  }

  const done = []; // stock already reduced (for rollback)
  const orderItems = [];
  let total = 0;
  let failMsg = null;

  try {
    for (const [productId, qty] of wanted) {
      // Atomic: reduce stock only if enough quantity is available
      const updated = await Product.findOneAndUpdate(
        { _id: productId, isAvailable: true, quantity: { $gte: qty } },
        { $inc: { quantity: -qty } },
        { new: true }
      );

      if (!updated) {
        const p = await Product.findById(productId).select("name");
        failMsg = p ? `Not enough stock for ${p.name}` : "A product in your cart no longer exists";
        break;
      }

      done.push({ product: updated._id, quantity: qty });
      if (updated.quantity === 0) {
        updated.isAvailable = false;
        await updated.save();
      }

      orderItems.push({
        product: updated._id,
        farmer: updated.farmer,
        name: updated.name,
        image: updated.image,
        price: updated.price,
        unit: updated.unit,
        quantity: qty,
      });
      total += updated.price * qty;
    }

    if (failMsg) {
      await restoreStock(done.splice(0));
      return res.status(400).json({ msg: failMsg });
    }

    const order = await Order.create({
      buyer: req.user.id,
      items: orderItems,
      totalAmount: Math.round(total * 100) / 100,
      shippingAddress,
      paymentMethod,
    });

    res.status(201).json({ msg: "Order placed", order });
  } catch (err) {
    await restoreStock(done.splice(0));
    throw err;
  }
};

// GET /api/orders/my  (buyer)
const getMyOrders = async (req, res) => {
  const orders = await Order.find({ buyer: req.user.id }).sort({ createdAt: -1 });
  res.json({ count: orders.length, orders });
};

// GET /api/orders/farmer  (farmer) - orders containing this farmer's products
const getFarmerOrders = async (req, res) => {
  const orders = await Order.find({ "items.farmer": req.user.id })
    .populate("buyer", "name phone")
    .sort({ createdAt: -1 });

  const result = orders.map((o) => {
    const obj = o.toObject();
    obj.items = obj.items.filter((i) => i.farmer.toString() === req.user.id);
    obj.farmerTotal = obj.items.reduce((s, i) => s + i.price * i.quantity, 0);
    return obj;
  });

  res.json({ count: result.length, orders: result });
};

// GET /api/orders/:id  (buyer owner, farmer in order, admin)
const getOrderById = async (req, res) => {
  const order = await Order.findById(req.params.id).populate("buyer", "name phone email");
  if (!order) return res.status(404).json({ msg: "Order not found" });

  const isBuyer = order.buyer._id.toString() === req.user.id;
  const isFarmer = req.user.role === "farmer" && isFarmerOfOrder(order, req.user.id);
  if (!isBuyer && !isFarmer && req.user.role !== "admin") {
    return res.status(403).json({ msg: "Not allowed to view this order" });
  }

  res.json(order);
};

// PUT /api/orders/:id/cancel  (buyer, only before shipping)
const cancelOrder = async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ msg: "Order not found" });
  if (order.buyer.toString() !== req.user.id) {
    return res.status(403).json({ msg: "Not your order" });
  }
  if (!["pending", "confirmed"].includes(order.status)) {
    return res.status(400).json({ msg: `Cannot cancel an order that is ${order.status}` });
  }

  await restoreStock(order.items);
  order.status = "cancelled";
  if (order.paymentStatus === "paid") order.paymentStatus = "refund_pending";
  await order.save();

  res.json({ msg: "Order cancelled", order });
};

// PUT /api/orders/:id/status  (farmer of this order, or admin)  body: { status }
const updateOrderStatus = async (req, res) => {
  const { status } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ msg: "Order not found" });

  if (req.user.role === "farmer" && !isFarmerOfOrder(order, req.user.id)) {
    return res.status(403).json({ msg: "This order has none of your products" });
  }
  if (!STATUS_FLOW[order.status].includes(status)) {
    return res.status(400).json({
      msg: `Cannot change status from ${order.status} to ${status}`,
      allowed: STATUS_FLOW[order.status],
    });
  }
  if (status === "confirmed" && order.paymentMethod === "online" && order.paymentStatus !== "paid") {
    return res.status(400).json({ msg: "Online payment is still pending" });
  }

  if (status === "cancelled") {
    await restoreStock(order.items);
    if (order.paymentStatus === "paid") order.paymentStatus = "refund_pending";
  }

  // Cash on delivery: payment is collected at delivery
  if (status === "delivered" && order.paymentMethod === "cod" && order.paymentStatus !== "paid") {
    order.paymentStatus = "paid";
    await Payment.create({
      order: order._id,
      buyer: order.buyer,
      amount: order.totalAmount,
      method: "cod",
      status: "paid",
      paidAt: new Date(),
    });
  }

  order.status = status;
  await order.save();
  res.json({ msg: `Order ${status}`, order });
};

module.exports = {
  createOrder,
  getMyOrders,
  getFarmerOrders,
  getOrderById,
  cancelOrder,
  updateOrderStatus,
};
