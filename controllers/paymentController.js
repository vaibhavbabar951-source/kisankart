const crypto = require("crypto");
const Razorpay = require("razorpay");
const Order = require("../models/Order");
const Payment = require("../models/Payment");

const getRazorpay = () => {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
};

// POST /api/payments/create  (buyer)  body: { orderId }
// Creates a Razorpay order; frontend opens Razorpay checkout with the returned data
const createPayment = async (req, res) => {
  const { orderId } = req.body || {};
  const order = await Order.findById(orderId);

  if (!order) return res.status(404).json({ msg: "Order not found" });
  if (order.buyer.toString() !== req.user.id) return res.status(403).json({ msg: "Not your order" });
  if (order.paymentMethod !== "online") {
    return res.status(400).json({ msg: "This order is Cash on Delivery" });
  }
  if (order.status === "cancelled") return res.status(400).json({ msg: "Order is cancelled" });
  if (!["pending", "failed"].includes(order.paymentStatus)) {
    return res.status(400).json({ msg: `Payment already ${order.paymentStatus}` });
  }

  const razorpay = getRazorpay();
  if (!razorpay) {
    return res.status(503).json({ msg: "Payment gateway is not configured on the server" });
  }

  const rzpOrder = await razorpay.orders.create({
    amount: Math.round(order.totalAmount * 100), // paise
    currency: "INR",
    receipt: order._id.toString(),
  });

  const payment = await Payment.create({
    order: order._id,
    buyer: req.user.id,
    amount: order.totalAmount,
    method: "online",
    status: "created",
    razorpayOrderId: rzpOrder.id,
  });

  res.status(201).json({
    keyId: process.env.RAZORPAY_KEY_ID,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    currency: rzpOrder.currency,
    paymentId: payment._id,
  });
};

// POST /api/payments/verify  (buyer)
// body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
const verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ msg: "Razorpay payment details are required" });
  }

  const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, buyer: req.user.id });
  if (!payment) return res.status(404).json({ msg: "Payment record not found" });
  if (payment.status === "paid") return res.json({ msg: "Payment already verified", payment });

  const order = await Order.findById(payment.order);

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!valid) {
    payment.status = "failed";
    await payment.save();
    order.paymentStatus = "failed";
    await order.save();
    return res.status(400).json({ msg: "Payment verification failed" });
  }

  payment.status = "paid";
  payment.razorpayPaymentId = razorpay_payment_id;
  payment.razorpaySignature = razorpay_signature;
  payment.paidAt = new Date();
  await payment.save();

  order.paymentStatus = "paid";
  if (order.status === "pending") order.status = "confirmed";
  await order.save();

  res.json({ msg: "Payment successful", payment, order });
};

// GET /api/payments/my  (buyer)
const getMyPayments = async (req, res) => {
  const payments = await Payment.find({ buyer: req.user.id }).sort({ createdAt: -1 });
  res.json({ count: payments.length, payments });
};

module.exports = { createPayment, verifyPayment, getMyPayments };
